// Backend/Controllers/ChartController.js
const axios = require('axios');
const { ensureAccessToken } = require('./upstoxController'); // adjust path if necessary

/**
 * Get historical candle data proxied from Upstox.
 * Query params:
 *   - instrument_key (preferred) OR symbol
 *   - from (YYYY-MM-DD)
 *   - to   (YYYY-MM-DD)
 *   - interval (minutes) default 5
 */
async function getChartData(req, res) {
  try {
    const { instrument_key, symbol, from, to, interval = '5' } = req.query;
    if ((!instrument_key && !symbol) || !from || !to) {
      return res.status(400).json({ error: 'instrument_key or symbol, from and to are required' });
    }

    // Get a fresh token using your upstox helper (will attempt refresh if needed)
    let token;
    try {
      token = await ensureAccessToken();
    } catch (err) {
      // Pass through reauth/config errors with informative messages
      console.error('[ChartController] ensureAccessToken error:', err.code || err.message);
      if (err.code === 'REAUTH_REQUIRED') {
        return res.status(401).json({ error: 'Re-authorization required: refresh token missing/invalid' });
      }
      return res.status(500).json({ error: 'Server error obtaining Upstox token', detail: err.message });
    }

    if (!token) {
      return res.status(500).json({ error: 'Server missing Upstox access token' });
    }

    const id = instrument_key ? encodeURIComponent(instrument_key) : encodeURIComponent(symbol);
    const f = encodeURIComponent(from);
    const t = encodeURIComponent(to);
    const i = encodeURIComponent(interval);

    // Candidate URL patterns (tries multiple)
    const candidates = [
      `https://api.upstox.com/v3/historical-candle/${id}/minute/${i}/${f}/${t}`,
      `https://api.upstox.com/v3/historical-candle/${id}/minute/${i}/${t}/${f}`,
      `https://api.upstox.com/v2/historical-candle/${id}/minute/${i}/${f}/${t}`,
      `https://api.upstox.com/v2/historical-candle/${id}/minute/${i}/${t}/${f}`,
      `https://api.upstox.com/v3/historical-candle?instrument_key=${id}&interval=minute&resolution=${i}&from=${f}&to=${t}`,
    ];

    let upstreamRes = null;
    let lastErr = null;

    for (const url of candidates) {
      try {
        console.log('[ChartController] trying url:', url);
        upstreamRes = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          timeout: 30000,
        });
        console.log(`[ChartController] upstream status ${upstreamRes.status} for ${url}`);
        break; // success
      } catch (err) {
        lastErr = err;
        const status = err.response?.status;
        console.warn(`[ChartController] attempt failed for ${url} status:${status || 'N/A'} message:${err.message}`);
        if (err.response?.data) {
          // print small snippet
          console.warn('[ChartController] upstream body snippet:', JSON.stringify(err.response.data).slice(0, 800));
        }
      }
    }

    if (!upstreamRes) {
      // Return the last upstream error body if available for debugging
      return res.status(502).json({
        error: 'Failed to fetch chart data from Upstox',
        detail: lastErr?.response?.data || lastErr?.message,
      });
    }

    // Normalize and return
    const payload = upstreamRes.data;
    return res.json(payload?.data ? payload : { data: payload });
  } catch (err) {
    console.error('[ChartController] fatal:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

module.exports = { getChartData };
