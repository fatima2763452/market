import 'dotenv/config';
import http from "http";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { createIO, setFeedSubscriber } from "./sockets/io.js";
import { initializeDhanLMF, renewAccessToken } from './services/dhanAuth.js';
import { startTokenRenewalCron } from './cron/renewDhanToken.js';
import { startMasterRefreshCron } from './cron/masterRefresh.js';
import { setFeedInstance } from "./services/feedState.js";
import { loadDhanConfig, config } from "./config.js";

import { getDhanCredentials } from './services/dhanCredentialService.js';

const app = createApp();
const server = http.createServer(app);

// createIO now returns { io, market } (market = namespace)
const { io, market } = createIO(server);

// Initialize the DhanLMF service via the new auth module
const lmf = initializeDhanLMF();

// allow sockets layer to forward client "subscribe" to LMF
setFeedSubscriber((list, subscriptionType) => lmf.subscribe(list, subscriptionType));

// make it accessible to routes
setFeedInstance(lmf);

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL;
await mongoose.connect(MONGODB_URI);
console.log("✅ Mongo connected");

// Load Dhan config from DB before starting the server
await loadDhanConfig();

const PORT = Number(config?.port || process.env.PORT || 8081);
server.listen(PORT, async () => {
  console.log("🚀 Server listening on", PORT);

  // Check if the token needs renewal on startup by checking JWT expiry
  console.log("Checking token validity on startup...");
  const credentials = await getDhanCredentials();
  if (credentials && credentials.accessToken) {
    try {
      // Decode JWT to get actual expiry
      const payload = JSON.parse(Buffer.from(credentials.accessToken.split('.')[1], 'base64').toString());
      const expiryTime = new Date(payload.exp * 1000);
      const now = new Date();
      const hoursUntilExpiry = (expiryTime - now) / (1000 * 60 * 60);

      console.log(`Token expires at: ${expiryTime.toISOString()} (${hoursUntilExpiry.toFixed(2)} hours remaining)`);

      // Renew if less than 2 hours remaining
      if (hoursUntilExpiry < 2) {
        if (hoursUntilExpiry <= 0) {
          console.error("❌ Token has EXPIRED! Cannot renew. Please generate fresh token from Dhan Web.");
          console.error("   Go to: https://web.dhan.co → My Profile → Access DhanHQ APIs");
          console.error("   Then run: node scripts/init-dhan-credentials.js");
        } else {
          console.log(`⏰ Token expires in ${hoursUntilExpiry.toFixed(2)} hours. Performing initial renewal...`);
          await renewAccessToken();
        }
      } else {
        console.log(`✅ Token is still valid for ${hoursUntilExpiry.toFixed(2)} hours. Skipping initial renewal.`);
      }
    } catch (e) {
      console.error("⚠️  Failed to decode token expiry:", e.message);
    }
  } else {
    console.warn("⚠️  No credentials found in database.");
  }

  // Start the cron job for automatic token renewal
  startTokenRenewalCron();

  // Start the cron job for automatic master data refresh
  startMasterRefreshCron();
});
