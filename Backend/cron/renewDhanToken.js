// Backend/cron/renewDhanToken.js
import cron from 'node-cron';
import { renewAccessToken } from '../services/dhanAuth.js';
import { getDhanCredentials } from '../services/dhanCredentialService.js';

// Schedule the cron job to run every hour
export function startTokenRenewalCron() {
  console.log('Scheduling cron job for Dhan token renewal...');
  cron.schedule('0 * * * *', async () => {
    console.log('Running scheduled Dhan token renewal check...');
    const credentials = await getDhanCredentials();
    if (credentials) {
      const tokenUpdatedAt = new Date(credentials.updatedAt);
      const now = new Date();
      const hoursSinceLastUpdate = (now - tokenUpdatedAt) / (1000 * 60 * 60);

      // Renew if the token is more than 23 hours old
      if (hoursSinceLastUpdate > 23) {
        console.log('Dhan token is nearing expiration, renewing...');
        await renewAccessToken();
      } else {
        console.log('Dhan token is not yet due for renewal.');
      }
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Use an appropriate timezone
  });
  console.log('Cron job for Dhan token renewal has been scheduled to run every hour.');
}
