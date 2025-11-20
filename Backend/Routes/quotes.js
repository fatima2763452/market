// Routes/quotes.js (or part of it)
import express from "express";
import fetch from "node-fetch";
import { config } from "../config.js";
import { getFeedInstance } from "../services/feedState.js"; // you said you have setFeedInstance

const router = express.Router();

// POST /api/quotes/snapshot
// body: { items: [{ segment, securityId }, ...] }
router.post("/snapshot", async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const securityIds = items.map(i => String(i.securityId));
    const lmf = getFeedInstance();

    // 1) try cached snapshot from live feed
    const cached = lmf?.getSnapshot?.(securityIds) || {};
    // build response using cached where present
    const out = {};
    for (const id of securityIds) {
        const v = cached[String(id)];
        if (v) {
            out[String(id)] = {
                ltp: v.ltp,
                open: v.open,
                high: v.high,
                low: v.low,
                close: v.close,
                volume: v.volume,
                oi: v.oi,
                bestBidPrice: v.bestBidPrice,
                bestBidQuantity: v.bestBidQuantity,
                bestAskPrice: v.bestAskPrice,
                bestAskQuantity: v.bestAskQuantity,
                lastTradeQty: v.lastTradeQty,
                lastTradeTime: v.lastTradeTime,
                avgPrice: v.avgPrice,
                netChange: v.netChange,
                percentChange: v.percentChange,
            };
        }
    }

    // 2) find ids that are missing or appear empty -> try provider snapshot for them
    const missing = securityIds.filter(id => {
      const v = out[String(id)];
      return !v || (v.ltp == null && v.close == null && v.netChange == null && v.percentChange == null);
    });

    if (missing.length && config.dhan?.token) {
      try {
        // provider snapshot endpoint (HTTPS)
        // NOTE: Dhan feed snapshot docs may require a different body shape. Use this only as fallback.
        const url = `https://api-feed.dhan.co/market/snapshot?clientId=${encodeURIComponent(config.dhan.clientId||"")}`;
        const body = { items: missing.map(id => ({ SecurityId: String(id) })) };

        const r = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "access-token": config.dhan.token,
          },
          body: JSON.stringify(body),
          timeout: 5000,
        });

        if (r.ok) {
          const provider = await r.json();
          console.log("[Backend Snapshot] Dhan API response for missing items:", provider);
          // provider likely returns a map of securityId => data
          for (const id of missing) {
            if (provider[String(id)]) {
              out[String(id)] = provider[String(id)];
            }
          }
        } else {
          const txt = await r.text().catch(() => "");
          out.__snapshot_error = `provider responded ${r.status}: ${txt}`;
        }
      } catch (e) {
        out.__snapshot_error = `provider fetch failed: ${e?.message || e}`;
      }
    } else if (missing.length) {
      out.__snapshot_info = "missing items; no server token available to query provider snapshot.";
    }

    return res.json(out);
  } catch (err) {
    console.error("snapshot route error:", err);
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
