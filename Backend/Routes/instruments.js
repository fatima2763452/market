// Routes/instruments.js
import { Router } from "express";
import Instrument from "../Model/InstrumentModel.js";   // ✅ .js zaroori

const router = Router();

// /api/instruments/search?q=TEXT&category=CATEGORY
router.get("/search", async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();
        const category = String(req.query.category || "All").trim();
        if (!q) return res.json([]);

        // --- 1. Keyword & Pattern Detection ---
        const upperQ = q.toUpperCase();
        const intent = {
            isFuture: /FUT|FUTURE/.test(upperQ),
            isOption: /OPT|OPTION|CE|CALL|PE|PUT/.test(upperQ),
            isCommodity: /GOLD|SILVER|CRUDE|NATURALGAS/.test(upperQ),
        };

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
                segmentFilter = ["NSE_EQ", "BSE_EQ", "NSE_FNO", "MCX_COMM", "NSE_COMM", "NSE_INDEX"];
                break;
        }

        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        
        // --- 2. Dynamic Scoring Logic in Aggregation Pipeline ---
        const rows = await Instrument.aggregate([
            {
                $match: {
                    segment: { $in: segmentFilter },
                    $or: [
                        { tradingsymbol: regex },
                        { symbol_name:  regex },
                        { display_name: regex }
                    ]
                }
            },
            {
                $addFields: {
                    relevanceScore: {
                        $let: {
                            vars: {
                                textScore: {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ["$tradingsymbol", upperQ] }, then: 100 },
                                            { case: { $eq: ["$symbol_name", upperQ] }, then: 90 },
                                            { case: { $regexMatch: { input: "$tradingsymbol", regex: `^${q}$`, options: "i" } }, then: 80 },
                                            { case: { $regexMatch: { input: "$symbol_name", regex: `^${q}$`, options: "i" } }, then: 70 },
                                        ],
                                        default: 10
                                    }
                                },
                                categoryBoost: {
                                    $cond: {
                                        if: { $and: [ { $eq: [category, "Commodity"] }, { $in: ["$segment", ["MCX_COMM", "NSE_COMM"]] } ] },
                                        then: 500,
                                        else: 0
                                    }
                                },
                                intentBoost: {
                                    $cond: {
                                        if: { $and: [ intent.isFuture, { $in: ["$instrumentType", ["FUTIDX", "FUTSTK", "FUTCOM", "FUTCUR"]] } ] },
                                        then: 200,
                                        else: {
                                            $cond: {
                                                if: { $and: [ intent.isOption, { $in: ["$instrumentType", ["OPTIDX", "OPTSTK", "OPTFUT", "OPTCUR"]] } ] },
                                                then: 200,
                                                else: {
                                                    $cond: {
                                                        if: { $and: [ intent.isCommodity, { $in: ["$segment", ["MCX_COMM", "NSE_COMM"]] } ] },
                                                        then: 200,
                                                        else: 0
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            in: { $add: ["$$textScore", "$$categoryBoost", "$$intentBoost"] }
                        }
                    }
                }
            },
            {
                $sort: {
                    relevanceScore: -1 // Sort by the new score in descending order
                }
            },
            {
                $limit: 100
            },
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
                    relevanceScore: 1 // Optional: for debugging
                }
            }
        ]);

        res.json(rows);
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
