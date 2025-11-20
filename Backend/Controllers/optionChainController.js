// import axios from 'axios';
// import { ensureAccessToken } from './upstoxController.js';

/**
 * Fetches an option chain.
 * This feature is currently disabled pending migration to Dhan.
 */
async function getOptionChain(req, res) {
    return res.status(501).json({ error: 'Option chain feature is not implemented yet.' });
}

export { getOptionChain };
