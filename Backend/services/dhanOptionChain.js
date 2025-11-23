// Backend/services/dhanOptionChain.js
import axios from 'axios';
import { config } from '../config.js';

/**
 * Fetch Option Chain data from Dhan API
 * @param {Object} params - { underlyingScrip, underlyingSeg, expiry }
 * @returns {Promise<Object>} Formatted option chain data
 */
export async function getDhanOptionChain(params) {
  const { underlyingScrip, underlyingSeg, expiry } = params;
  
  try {
    // console.log('[DhanOptionChain] Fetching data:', { underlyingScrip, underlyingSeg, expiry });
    
    // Dhan API endpoint for option chain
    const url = 'https://api.dhan.co/v2/optionchain';
    
    const payload = {
      UnderlyingScrip: Number(underlyingScrip),
      UnderlyingSeg: underlyingSeg,
      Expiry: expiry  // Format: "YYYY-MM-DD"
    };
    
    // console.log('[DhanOptionChain] Sending request to Dhan API:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(url, payload, {
      headers: {
        'access-token': config.dhan.token,
        'client-id': config.dhan.clientId,  // Official Dhan API uses 'client-id' (lowercase with hyphen)
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 4000 // 4 second timeout
    });
    
    // console.log('[DhanOptionChain] Received response status:', response.status);

    // Transform Dhan response to frontend-friendly format
    return transformOptionChainData(response.data);
    
  } catch (error) {
    console.error('[DhanOptionChain] API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    // Provide more specific error messages
    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please check Dhan access token.');
    } else if (error.response?.status === 400) {
      throw new Error(`Invalid request: ${error.response?.data?.message || 'Bad parameters'}`);
    } else if (error.response?.status === 404) {
      throw new Error('Option chain data not found for the specified instrument.');
    } else if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Wait 3 seconds between requests.');
    }
    
    throw new Error(`Failed to fetch option chain: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Transform Dhan's option chain response to frontend format
 * Converts strike-based object structure to array format with calculated PCR
 * @param {Object} dhanData - Dhan API response
 * @returns {Object} Formatted option chain data
 */
function transformOptionChainData(dhanData) {
  // console.log('[DhanOptionChain] Transforming data');

  if (!dhanData || !dhanData.data) {
    throw new Error('Invalid response from Dhan API - missing data field');
  }

  const { last_price, oc } = dhanData.data;

  if (!oc || typeof oc !== 'object') {
    throw new Error('Invalid response from Dhan API - missing option chain data');
  }

  // Convert strike-based object to array
  const chainArray = [];
  
  for (const [strikeStr, strikeData] of Object.entries(oc)) {
    const strike = parseFloat(strikeStr);
    
    const row = {
      strike: strike,
      call: null,
      put: null,
      pcr: null
    };

    // Format Call Option data
    if (strikeData.ce) {
      const ce = strikeData.ce;
      row.call = {
        ltp: ce.last_price || 0,
        oi: ce.oi || 0,
        oi_chg: (ce.oi || 0) - (ce.previous_oi || 0),
        volume: ce.volume || 0,
        bid: ce.top_bid_price || 0,
        ask: ce.top_ask_price || 0,
        iv: ce.implied_volatility || 0,
        delta: ce.greeks?.delta || 0,
        gamma: ce.greeks?.gamma || 0,
        theta: ce.greeks?.theta || 0,
        vega: ce.greeks?.vega || 0,
        prev_close: ce.previous_close_price || 0,
        prev_oi: ce.previous_oi || 0,
        net_change_pct: ce.previous_close_price 
          ? ((ce.last_price - ce.previous_close_price) / ce.previous_close_price) * 100 
          : 0
      };
    }

    // Format Put Option data
    if (strikeData.pe) {
      const pe = strikeData.pe;
      row.put = {
        ltp: pe.last_price || 0,
        oi: pe.oi || 0,
        oi_chg: (pe.oi || 0) - (pe.previous_oi || 0),
        volume: pe.volume || 0,
        bid: pe.top_bid_price || 0,
        ask: pe.top_ask_price || 0,
        iv: pe.implied_volatility || 0,
        delta: pe.greeks?.delta || 0,
        gamma: pe.greeks?.gamma || 0,
        theta: pe.greeks?.theta || 0,
        vega: pe.greeks?.vega || 0,
        prev_close: pe.previous_close_price || 0,
        prev_oi: pe.previous_oi || 0,
        net_change_pct: pe.previous_close_price 
          ? ((pe.last_price - pe.previous_close_price) / pe.previous_close_price) * 100 
          : 0
      };
    }

    // Calculate Put-Call Ratio
    if (row.call?.oi && row.put?.oi) {
      row.pcr = row.put.oi / row.call.oi;
    }

    chainArray.push(row);
  }

  // Sort by strike price
  chainArray.sort((a, b) => a.strike - b.strike);

  // console.log('[DhanOptionChain] Transformed', chainArray.length, 'strikes');
  // console.log('[DhanOptionChain] First strike:', chainArray[0]?.strike);
  // console.log('[DhanOptionChain] Last strike:', chainArray[chainArray.length - 1]?.strike);

  return {
    underlyingLtp: last_price,
    chain: chainArray,
    totalStrikes: chainArray.length
  };
}

/**
 * Fetch list of available expiry dates for an underlying
 * @param {Object} params - { underlyingScrip, underlyingSeg }
 * @returns {Promise<Array<string>>} Array of expiry dates in YYYY-MM-DD format
 */
export async function getDhanExpiryList(params) {
  const { underlyingScrip, underlyingSeg } = params;
  
  try {
    // console.log('[DhanExpiryList] Fetching expiries:', { underlyingScrip, underlyingSeg });
    
    const url = 'https://api.dhan.co/v2/optionchain/expirylist';
    
    const payload = {
      UnderlyingScrip: Number(underlyingScrip),
      UnderlyingSeg: underlyingSeg
    };
    
    // console.log('[DhanExpiryList] Sending request:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(url, payload, {
      headers: {
        'access-token': config.dhan.token,
        'client-id': config.dhan.clientId,  // Official Dhan API uses 'client-id' (lowercase with hyphen)
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    // console.log('[DhanExpiryList] Received response status:', response.status);

    if (!response.data?.data || !Array.isArray(response.data.data)) {
      throw new Error('Invalid response format from Dhan API');
    }

    const expiries = response.data.data;
    // console.log('[DhanExpiryList] Found', expiries.length, 'expiries');

    return expiries;
    
  } catch (error) {
    console.error('[DhanExpiryList] API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please check Dhan access token.');
    } else if (error.response?.status === 400) {
      throw new Error(`Invalid request: ${error.response?.data?.message || 'Bad parameters'}`);
    }
    
    throw new Error(`Failed to fetch expiry list: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Get nearest expiry date for an underlying
 * @param {Array<string>} expiries - Array of expiry dates
 * @returns {string} Nearest expiry date in YYYY-MM-DD format
 */
export function getNearestExpiry(expiries) {
  if (!expiries || !Array.isArray(expiries) || expiries.length === 0) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter future expiries and find the nearest one
  const futureExpiries = expiries
    .map(exp => new Date(exp))
    .filter(exp => exp >= today)
    .sort((a, b) => a - b);

  if (futureExpiries.length === 0) {
    return null;
  }

  // Return in YYYY-MM-DD format
  return futureExpiries[0].toISOString().split('T')[0];
}
