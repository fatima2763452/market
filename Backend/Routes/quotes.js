// Routes/quotes.js (or part of it)
import express from "express";
import { getFeedInstance } from "../services/feedState.js";

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

    // 2) find ids that are missing or appear empty
    const missing = securityIds.filter(id => {
      const v = out[String(id)];
      return !v || (v.ltp == null && v.close == null && v.netChange == null && v.percentChange == null);
    });

    // If data is missing, it means these instruments haven't been subscribed to the WebSocket feed yet.
    // The frontend should call subscribe() before fetching snapshot.
    if (missing.length) {
      console.log(`[Snapshot] ${missing.length} instruments not found in cache. They may not be subscribed to the feed yet.`);
      // Initialize empty objects for missing items so frontend can handle gracefully
      for (const id of missing) {
        if (!out[String(id)]) {
          out[String(id)] = {
            ltp: null, open: null, high: null, low: null, close: null, volume: null, oi: null,
            bestBidPrice: null, bestBidQuantity: null, bestAskPrice: null, bestAskQuantity: null,
            lastTradeQty: null, lastTradeTime: null, avgPrice: null, netChange: null, percentChange: null,
          };
        }
      }
      out.__snapshot_info = `${missing.length} instruments not in cache. Ensure they are subscribed via WebSocket.`;
    }

    return res.json(out);
  } catch (err) {
    console.error("snapshot route error:", err);
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
