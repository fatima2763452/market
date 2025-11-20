// config.js

import { getDhanCredentials } from './services/dhanCredentialService.js';

let dhanConfig = {};

export const loadDhanConfig = async () => {
    const credentials = await getDhanCredentials();
    if (!credentials) {
        throw new Error("FATAL: Could not load Dhan credentials from the database.");
    }
    dhanConfig.clientId = credentials.clientId;
    dhanConfig.token = credentials.accessToken;
};

export const config = {
    dhan: {
        endpoint: "wss://api-feed.dhan.co",
        get clientId() {
            return dhanConfig.clientId;
        },
        get token() {
            return dhanConfig.token;
        },
        set token(newToken) {
            dhanConfig.token = newToken;
        }
    },
    origin: process.env.CORS_ORIGIN,
    port: process.env.PORT
};

