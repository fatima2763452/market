// Backend/Controllers/ChartController.js
// import axios from 'axios';
// import { ensureAccessToken } from './upstoxController.js'; // adjust path if necessary

/**
 * Get historical candle data.
 * This feature is currently disabled pending migration to Dhan.
 */
async function getChartData(req, res) {
  return res.status(501).json({ error: 'Chart data feature is not implemented yet.' });
}

export { getChartData };
