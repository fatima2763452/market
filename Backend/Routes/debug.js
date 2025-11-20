import express from 'express';
import { getDhanCredentials } from '../services/dhanCredentialService.js';
import { renewAccessToken } from '../services/dhanAuth.js';

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