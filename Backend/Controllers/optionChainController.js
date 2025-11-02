const axios = require("axios");
// Ensure ensureAccessToken is correctly imported from your Upstox auth controller
const { ensureAccessToken } = require("./upstoxController"); 

async function getOptionChain(req, res) {
    try {
        // 1. Destructure and Encode Parameters
        const { symbol, expiry_date } = req.query; 

        if (!symbol || !expiry_date) {
            return res.status(400).json({ error: "Missing required query parameters: symbol and expiry_date" });
        }
        
        const encodedSymbol = encodeURIComponent(symbol);
        const encodedExpiry = encodeURIComponent(expiry_date);

        // 2. Ensure Access Token
        const access_token = await ensureAccessToken();

        // 3. Construct URL with Encoded Parameters
        const url = `https://api.upstox.com/v2/option/chain?instrument_key=${encodedSymbol}&expiry_date=${encodedExpiry}`;
        
        console.log(`Fetching Option Chain for: ${symbol} on ${expiry_date}`);

        // 4. Make API Call (Removed redundant Content-Type header)
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${access_token}`,
                Accept: "application/json",
            },
        });

        // 5. Success Response
        res.json(response.data);
    } catch (err) {
        // 6. Detailed Error Handling
        console.error("Option chain API error:", err.response?.data || err.message);
        
        const status = err.response?.status || 500;
        const errorDetails = err.response?.data?.errors?.[0]?.message || err.message;
        
        res.status(status).json({ 
            error: "Failed to fetch option chain from Upstox",
            details: errorDetails
        });
    }
}

module.exports = { getOptionChain };