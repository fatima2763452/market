const axios = require("axios");
// Assumes ensureAccessToken handles OAuth token refresh/retrieval
const { ensureAccessToken } = require("./upstoxController"); 

const UPSTOX_QUOTE_URL = process.env.UPSTOX_QUOTE_URL || "https://api.upstox.com/v2/market-quote/quotes"; 
// Using v2 format for quotes with standard path
const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || "3", 10); // 3 seconds cache

// In-memory cache: { instrument_key: { ts: timestamp, data: quoteData } }
let priceCache = {};

/**
 * Helper function to map raw Upstox quote data to a clean format.
 * (Adjust this mapping based on the exact fields returned by the Upstox API)
 */
const mapQuoteData = (quoteData) => {
    // We expect an array of data, but typically just grab the first element for a single quote endpoint
    const quote = Array.isArray(quoteData) ? quoteData[0] : quoteData;
    
    if (!quote) return null;

    // Use optional chaining for safety
    return {
        ltp: quote.lastPrice ?? quote.last_price ?? null,
        open: quote.ohlc?.open ?? null,
        day_high: quote.ohlc?.high ?? null,
        day_low: quote.ohlc?.low ?? null,
        volume: quote.volume ?? null,
        // Calculate change (net_change is often preferred for raw difference)
        net_change: quote.netChange ?? quote.net_change ?? null, 
        
        // --- Level 1 Depth Data (Crucial for OrderSheet) ---
        // Best Bid is the first element of the 'buy' array in depth
        bestBidPrice: quote.depth?.buy?.[0]?.price ?? null, 
        bestBidQuantity: quote.depth?.buy?.[0]?.quantity ?? null,
        // Best Ask is the first element of the 'sell' array in depth
        bestAskPrice: quote.depth?.sell?.[0]?.price ?? null, 
        bestAskQuantity: quote.depth?.sell?.[0]?.quantity ?? null,
        
        // Pass the raw depth object needed for the MarketDepthView
        depth: quote.depth ?? null, 
    };
};


/**
 * GET /upstox/quote?instrument_key=NSE_FO:RELIANCE-24NOV-FUT
 * Fetches a single quote, with short-term caching.
 */
exports.getQuote = async (req, res) => {
    // IMPORTANT: Upstox requires 'instrument_key' parameter (e.g., NSE_FO:12345)
    const instrument_key = req.query.instrument_key; 
    console.log("getQuote called with instrument_key:", instrument_key);

    if (!instrument_key) {
        return res.status(400).json({ error: "instrument_key query parameter is required." });
    }

    // 1. Check Cache
    const cached = priceCache[instrument_key];
    if (cached && Date.now() - cached.ts < CACHE_TTL * 1000) {
        return res.json({ fromCache: true, data: cached.data });
    }

    try {
        
        // 2. Ensure Access Token (Reuses existing auth logic)
        const access_token = await ensureAccessToken();

        // 3. Fetch from Upstox
        const upstoxRes = await axios.get(
            `${UPSTOX_QUOTE_URL}/latest?instrument_key=${encodeURIComponent(instrument_key)}`,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    Accept: "application/json",
                },
            }
        );

        // 4. Process and Cache Data
        const rawData = upstoxRes.data?.data;
        if (rawData) {
            const mappedData = mapQuoteData(rawData[instrument_key]); 
            
            if (mappedData) {
                priceCache[instrument_key] = { ts: Date.now(), data: mappedData };
                return res.json({ fromCache: false, data: mappedData });
            }
        }
        
        // Handle case where Upstox returns success but no data for the key
        return res.status(404).json({ error: "Quote data missing from Upstox response.", instrument_key });

    } catch (err) {
        // Handle network, token, or API errors
        console.error(`Upstox API Error for ${instrument_key}:`, err.response?.data?.errors || err.message);
        
        const status = err.response?.status || 500;
        const error_message = err.response?.data?.errors?.[0]?.message || "Internal API Error";
        
        return res.status(status).json({
            error: "Failed to fetch quote",
            details: error_message,
            instrument_key,
            statusCode: status,
        });
    }
};