// Routes/instruments.js
import { Router } from "express";
import Instrument from "../Model/InstrumentModel.js";
import { getSpotPrice } from "../services/spotPriceCache.js";

const router = Router();

// ATM filter percentage - strikes within ±X% of spot are considered ATM
const ATM_RANGE_PERCENT = 0.08; // ±8% range

/**
 * Smart search with ATM strike filtering
 * For options, only returns strikes near the current spot price
 */
router.get("/search", async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();
        const category = String(req.query.category || "All").trim();
        if (!q) return res.json([]);

        const upperQ = q.toUpperCase();
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

        // Define segment lists based on category
        let segmentFilter;
        switch (category) {
            case "Stocks":
                segmentFilter = ["NSE_EQ", "BSE_EQ"];
                break;
            case "F&O":
                segmentFilter = ["NSE_FNO"];
                break;
            case "Commodity":
                segmentFilter = ["MCX_COMM", "NSE_COMM"];
                break;
            case "All":
            default:
                segmentFilter = ["NSE_FNO", "MCX_COMM"];
                break;
        }

        // --- Step 1: Find unique underlying symbols that match the search ---
        const underlyingMatches = await Instrument.distinct("underlying_symbol", {
            segment: { $in: segmentFilter },
            underlying_symbol: { $exists: true, $ne: null },
            $or: [
                { tradingsymbol: regex },
                { symbol_name: regex },
                { display_name: regex },
                { underlying_symbol: regex }
            ]
        });

        // --- Step 2: Get spot prices for all matching underlyings ---
        const spotPrices = new Map();
        await Promise.all(
            underlyingMatches.slice(0, 10).map(async (underlying) => { // Limit to 10 underlyings
                const spot = await getSpotPrice(underlying);
                if (spot && spot > 0) {
                    spotPrices.set(underlying.toUpperCase(), spot);
                }
            })
        );

        console.log(`[Search] Found spot prices for ${spotPrices.size} underlyings:`, 
            Array.from(spotPrices.entries()).map(([k, v]) => `${k}:${v.toFixed(2)}`).join(', '));

        // --- Step 3: Build smart query with ATM filtering ---
        const now = new Date();
        
        // First, get futures (always include - they have liquidity)
        const futuresQuery = {
            segment: { $in: segmentFilter },
            instrumentType: { $in: ['FUTIDX', 'FUTSTK', 'FUTCOM', 'FUTCUR'] },
            expiry: { $gte: now },
            $or: [
                { tradingsymbol: regex },
                { symbol_name: regex },
                { display_name: regex },
                { underlying_symbol: regex }
            ]
        };

        const futures = await Instrument.find(futuresQuery)
            .sort({ expiry: 1 }) // Nearest expiry first
            .limit(50)
            .lean();

        // --- Step 4: Get ATM options for each underlying ---
        let options = [];
        
        for (const [underlying, spotPrice] of spotPrices) {
            const minStrike = spotPrice * (1 - ATM_RANGE_PERCENT);
            const maxStrike = spotPrice * (1 + ATM_RANGE_PERCENT);
            
            // Find nearest expiry for this underlying
            const nearestExpiry = await Instrument.findOne({
                underlying_symbol: { $regex: new RegExp(`^${underlying}$`, 'i') },
                segment: { $in: segmentFilter },
                instrumentType: { $in: ['OPTIDX', 'OPTSTK', 'OPTFUT', 'OPTCUR'] },
                expiry: { $gte: now }
            })
            .sort({ expiry: 1 })
            .select('expiry')
            .lean();

            if (!nearestExpiry) continue;

            // Get ATM options for nearest expiry
            const atmOptions = await Instrument.find({
                underlying_symbol: { $regex: new RegExp(`^${underlying}$`, 'i') },
                segment: { $in: segmentFilter },
                instrumentType: { $in: ['OPTIDX', 'OPTSTK', 'OPTFUT', 'OPTCUR'] },
                expiry: nearestExpiry.expiry,
                strike: { $gte: minStrike, $lte: maxStrike }
            })
            .sort({ strike: 1 })
            .limit(100) // Max 100 options per underlying (50 strikes x 2 CE/PE)
            .lean();

            options = options.concat(atmOptions);
        }

        // --- Step 5: If no spot prices found, fall back to basic search with filters ---
        if (spotPrices.size === 0) {
            console.log(`[Search] No spot prices available, using fallback search`);
            
            // Fallback: prioritize futures and limit options
            const fallbackResults = await Instrument.aggregate([
                {
                    $match: {
                        segment: { $in: segmentFilter },
                        expiry: { $gte: now },
                        $or: [
                            { tradingsymbol: regex },
                            { symbol_name: regex },
                            { display_name: regex }
                        ]
                    }
                },
                {
                    $addFields: {
                        // Boost futures over options
                        typeScore: {
                            $cond: {
                                if: { $in: ["$instrumentType", ["FUTIDX", "FUTSTK", "FUTCOM", "FUTCUR"]] },
                                then: 1000,
                                else: 0
                            }
                        },
                        // Boost nearest expiry
                        expiryScore: {
                            $subtract: [0, { $toLong: "$expiry" }]
                        }
                    }
                },
                { $sort: { typeScore: -1, expiryScore: -1 } },
                { $limit: 200 },
                {
                    $project: {
                        _id: 1,
                        securityId: 1,
                        segment: 1,
                        tradingsymbol: 1,
                        symbol_name: 1,
                        display_name: 1,
                        expiry: 1,
                        lotSize: 1,
                        instrumentType: 1,
                        strike: 1,
                        optionType: 1
                    }
                }
            ]);
            
            return res.json(fallbackResults);
        }

        // --- Step 6: Combine and sort results ---
        const combined = [...futures, ...options];
        
        // Remove duplicates by securityId
        const seen = new Set();
        const unique = combined.filter(item => {
            if (seen.has(item.securityId)) return false;
            seen.add(item.securityId);
            return true;
        });

        // Sort: futures first, then by expiry, then by distance from ATM
        unique.sort((a, b) => {
            // Futures before options
            const aIsFuture = ['FUTIDX', 'FUTSTK', 'FUTCOM', 'FUTCUR'].includes(a.instrumentType);
            const bIsFuture = ['FUTIDX', 'FUTSTK', 'FUTCOM', 'FUTCUR'].includes(b.instrumentType);
            if (aIsFuture && !bIsFuture) return -1;
            if (!aIsFuture && bIsFuture) return 1;
            
            // Then by expiry (nearest first)
            const expiryDiff = new Date(a.expiry) - new Date(b.expiry);
            if (expiryDiff !== 0) return expiryDiff;
            
            // Then by strike (for options with same underlying)
            if (a.strike && b.strike) {
                return a.strike - b.strike;
            }
            
            return 0;
        });

        // Format response - return up to 200 results
        const results = unique.slice(0, 200).map(item => ({
            _id: item._id,
            securityId: item.securityId,
            segment: item.segment,
            tradingsymbol: item.tradingsymbol,
            symbol_name: item.symbol_name,
            display_name: item.display_name,
            expiry: item.expiry,
            lotSize: item.lotSize,
            instrumentType: item.instrumentType,
            strike: item.strike,
            optionType: item.optionType
        }));

        console.log(`[Search] Returning ${results.length} results (${futures.length} futures, ${options.length} ATM options)`);
        res.json(results);

    } catch (e) {
        console.error("instruments/search error:", e);
        res.status(500).json({ error: "failed" });
    }
});

// New endpoint to get a list of instruments for the watchlist
// New endpoint to get a list of instruments for the watchlist
router.get("/watchlist", async (req, res) => {
    try {
        // Define a list of popular stock keywords for the Indian F&O market
        const popularKeywords = [
            "RELIANCE", "HDFCBANK", "ICICIBANK", "INFY", "TCS", "KOTAKBANK",
            "HINDUNILVR", "ITC", "BHARTIARTL", "SBIN", "BAJFINANCE", "LT",
            "AXISBANK", "MARUTI", "ASIANPAINT", "WIPRO", "TATAMOTORS", "TATASTEEL"
        ];
        const regex = new RegExp(popularKeywords.join("|"), "i");

        // Fetch instruments that match the popular keywords
        const instruments = await Instrument.find({
            segment: "NSE_FNO",
            display_name: { $regex: regex }
        })
        .select("securityId segment tradingsymbol symbol_name display_name expiry lotSize instrumentType")
        .limit(100)
        .lean();

        console.log(`[Watchlist] Found ${instruments.length} popular NSE_FNO instruments for watchlist.`);
        res.json(instruments);
    } catch (e) {
        console.error("instruments/watchlist error:", e);
        res.status(500).json({ error: "failed" });
    }
});

// New endpoint to get replacement instruments for the watchlist
router.post("/replacements", async (req, res) => {
    try {
        const { exclude = [], count = 1 } = req.body;

        const instruments = await Instrument.aggregate([
            {
                $match: {
                    segment: "NSE_FNO",
                    expiry: { $gte: new Date() }, // Ensure the instrument is not expired
                    securityId: { $nin: exclude } // Exclude already present IDs
                }
            },
            {
                $sample: { size: count } // Get 'count' random instruments
            },
            {
                $project: {
                    securityId: 1,
                    segment: 1,
                    tradingsymbol: 1,
                    symbol_name: 1,
                    display_name: 1,
                    expiry: 1,
                    lotSize: 1,
                    instrumentType: 1,
                }
            }
        ]);

        console.log(`[Replacements] Found ${instruments.length} new instruments.`);
        res.json(instruments);
    } catch (e) {
        console.error("instruments/replacements error:", e);
        res.status(500).json({ error: "failed" });
    }
});

// /api/instruments/resolve?... (optional)
router.get("/resolve", async (req, res) => {
    try {
        const { segment, tradingsymbol, underlying, instrumentType, expiry, strike, optionType } = req.query;
        const q = {};
        if (segment) q.segment = segment.toUpperCase();
        if (tradingsymbol) q.tradingsymbol = tradingsymbol.toUpperCase();
        if (underlying) q.underlying_symbol = underlying.toUpperCase();
        if (instrumentType) q.instrumentType = instrumentType.toUpperCase();
        if (optionType) q.optionType = optionType.toUpperCase();
        if (expiry) q.expiry = new Date(expiry);
        if (strike) q.strike = Number(strike);

        const doc = await Instrument.findOne(q).lean();
        if (!doc) return res.status(404).json({ error: "Instrument not found" });

        res.json({
            securityId: doc.securityId,
            segment: doc.segment,
            tradingsymbol: doc.tradingsymbol,
            lotSize: doc.lotSize
        });
    } catch (e) {
        console.error("instruments/resolve error:", e);
        res.status(500).json({ error: "failed" });
    }
});

// /api/instruments/lookup - Get instrument details by securityId and segment
router.get("/lookup", async (req, res) => {
    try {
        const { securityId, segment } = req.query;
        
        if (!securityId || !segment) {
            return res.status(400).json({ error: "securityId and segment are required" });
        }

        const instrument = await Instrument.findOne({
            securityId: String(securityId),
            segment: segment
        })
        .select("securityId segment tradingsymbol symbol_name display_name instrumentType")
        .lean();

        if (!instrument) {
            return res.status(404).json({ error: "Instrument not found" });
        }

        res.json(instrument);
    } catch (e) {
        console.error("instruments/lookup error:", e);
        res.status(500).json({ error: "failed" });
    }
});

export default router;
