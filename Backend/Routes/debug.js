import express from 'express';
import { getDhanCredentials } from '../services/dhanCredentialService.js';
import { renewAccessToken } from '../services/dhanAuth.js';
import Order from '../Model/OrdersModel.js';
import { attemptSquareoff } from '../cron/Scheduler/attemptSquareoff.js';

const router = express.Router();

// A temporary endpoint to manually trigger the token renewal logic.
router.post('/force-token-check', async (req, res) => {
  console.log('Manual token renewal check triggered via API endpoint...');
  
  try {
    const credentials = await getDhanCredentials();
    if (!credentials) {
      return res.status(404).json({ message: 'Dhan credentials not found in database.' });
    }

    const tokenUpdatedAt = new Date(credentials.updatedAt);
    const now = new Date();
    const hoursSinceLastUpdate = (now - tokenUpdatedAt) / (1000 * 60 * 60);

    if (hoursSinceLastUpdate > 23) {
      console.log('Token is old, performing renewal...');
      const newToken = await renewAccessToken();
      if (newToken) {
        res.status(200).json({ 
          status: 'RENEWED', 
          message: 'Token was older than 23 hours and has been successfully renewed.' 
        });
      } else {
        res.status(500).json({
          status: 'FAILED',
          message: 'Token renewal process was initiated but failed. Check server logs.'
        });
      }
    } else {
      console.log('Token is recent, skipping renewal.');
      res.status(200).json({ 
        status: 'SKIPPED', 
        message: `Token is not yet due for renewal. Last update was ${hoursSinceLastUpdate.toFixed(2)} hours ago.`
      });
    }
  } catch (error) {
    console.error('Error during manual token check:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  }
});

export default router;

// Manual trigger to run squareoff for a given category (for debugging)
router.post('/run-squareoff', async (req, res) => {
  const type = req.body?.type || 'OPEN_INTRADAY';
  try {
    let query;
    if (type === 'OPEN_INTRADAY') query = { order_category: 'INTRADAY', order_status: 'OPEN' };
    else if (type === 'HOLD_INTRADAY') query = { order_category: 'INTRADAY', order_status: 'HOLD' };
    else if (type === 'OVERNIGHT') query = { order_category: 'OVERNIGHT' };
    else return res.status(400).json({ error: 'unknown type' });

    const candidates = await Order.find(query).limit(200).lean();
    const results = [];
    for (const cand of candidates) {
      const orderDoc = await Order.findById(cand._id);
      if (!orderDoc) continue;
      const result = await attemptSquareoff(orderDoc);
      results.push({ id: orderDoc._id, result });
    }
    return res.json({ ok: true, count: results.length, results });
  } catch (err) {
    console.error('[debug/run-squareoff] error', err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});