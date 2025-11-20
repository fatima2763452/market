// Backend/services/dhanAuth.js
import axios from 'axios';
import { config } from '../config.js';
import { updateDhanAccessToken } from './dhanCredentialService.js';
import { DhanLMF } from './dhanLMF.js';

let dhanLMF;

export function initializeDhanLMF() {
  dhanLMF = new DhanLMF();
  return dhanLMF;
}

export async function renewAccessToken() {
  try {
    console.log('Attempting to renew Dhan access token...');

    // Validate config before attempting renewal
    if (!config.dhan.token || !config.dhan.clientId) {
      console.error('❌ Cannot renew token: Missing clientId or current token in config');
      console.error('   config.dhan.token:', config.dhan.token ? '(exists)' : '(missing)');
      console.error('   config.dhan.clientId:', config.dhan.clientId ? config.dhan.clientId : '(missing)');
      return null;
    }

    // Check if token is expired by decoding JWT
    try {
      const payload = JSON.parse(Buffer.from(config.dhan.token.split('.')[1], 'base64').toString());
      const expiry = new Date(payload.exp * 1000);
      const now = new Date();

      if (now > expiry) {
        console.error('❌ CANNOT RENEW: Token has EXPIRED!');
        console.error(`   Token expired at: ${expiry.toISOString()}`);
        console.error(`   Current time: ${now.toISOString()}`);
        console.error('');
        console.error('🔧 SOLUTION: Generate a fresh token from Dhan Web');
        console.error('   1. Go to https://web.dhan.co');
        console.error('   2. Navigate to: My Profile → Access DhanHQ APIs');
        console.error('   3. Generate new access token');
        console.error('   4. Run: node scripts/init-dhan-credentials.js');
        console.error('   5. Enter your clientId and new token');
        console.error('');
        return null;
      }

      console.log(`✅ Token is valid (expires: ${expiry.toISOString()})`);
    } catch (e) {
      console.warn('⚠️  Could not decode token to check expiry, continuing anyway...');
    }

    // DEBUG: Log what we're sending
    console.log('🔍 DEBUG: Sending renewal request with:');
    console.log('   URL: https://api.dhan.co/v2/RenewToken');
    console.log('   access-token:', config.dhan.token ? `${config.dhan.token.substring(0, 10)}...` : '(missing)');
    console.log('   client-id:', config.dhan.clientId);

    // Dhan API requires lowercase 'client-id' header (not 'dhanClientId')
    const response = await axios.post('https://api.dhan.co/v2/RenewToken', {}, {
      headers: {
        'access-token': config.dhan.token,
        'client-id': config.dhan.clientId,  // ← Fixed: lowercase with hyphen
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.accessToken) {
      const newToken = response.data.accessToken;
      console.log('✅ Successfully renewed Dhan access token.');

      // Update the token in the database (with clientId filter)
      const updated = await updateDhanAccessToken(config.dhan.clientId, newToken);
      if (!updated) {
        console.error('⚠️ Warning: Failed to update token in database, but continuing with in-memory update');
      }

      // Update the token in the running config
      config.dhan.token = newToken;

      // Update the token in the running DhanLMF service
      if (dhanLMF) {
        dhanLMF.setToken(newToken);
        // Reconnect WebSocket with new token for safety
        console.log('🔄 Reconnecting DhanLMF WebSocket with new token...');
        dhanLMF.close();
        await dhanLMF.connect();
      }

      return newToken;
    } else {
      console.error('❌ Failed to renew Dhan access token. Response did not contain a new token:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error renewing Dhan access token:', error.response ? error.response.data : error.message);
    return null;
  }
}
