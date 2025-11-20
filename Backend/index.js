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

  // Check if the token needs renewal on startup.
  console.log("Checking token validity on startup...");
  const credentials = await getDhanCredentials();
  if (credentials) {
    const tokenUpdatedAt = new Date(credentials.updatedAt);
    const now = new Date();
    const hoursSinceLastUpdate = (now - tokenUpdatedAt) / (1000 * 60 * 60);

    if (hoursSinceLastUpdate > 23) {
      console.log("Token is old, performing initial renewal...");
      await renewAccessToken();
    } else {
      console.log("Token is recent, skipping initial renewal.");
    }
  }

  // Start the cron job for automatic token renewal
  startTokenRenewalCron();

  // Start the cron job for automatic master data refresh
  startMasterRefreshCron();
});
