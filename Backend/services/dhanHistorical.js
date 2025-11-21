// Backend/services/dhanHistorical.js
import axios from 'axios';
import { config } from '../config.js';

/**
 * Fetch historical OHLC data from Dhan API (Daily candles)
 * @param {Object} params - { securityId, exchangeSegment, instrument, fromDate, toDate, expiryCode, oi }
 * @returns {Promise<Array>} Array of [timestamp, open, high, low, close, volume]
 */
export async function getDhanHistoricalData(params) {
  const { securityId, exchangeSegment, instrument, fromDate, toDate, expiryCode, oi } = params;
  
  try {
    console.log('[DhanHistorical] Fetching data:', { securityId, exchangeSegment, instrument, fromDate, toDate });
    
    // Dhan API endpoint for historical data
    const url = 'https://api.dhan.co/v2/charts/historical';
    
    const payload = {
      securityId: String(securityId),
      exchangeSegment: exchangeSegment,
      instrument: instrument,
      fromDate: fromDate,
      toDate: toDate
    };
    
    // Add expiryCode only for F&O instruments (all futures and options types)
    if (expiryCode !== undefined && ['FUTIDX', 'FUTSTK', 'OPTIDX', 'OPTSTK', 'FUTCOM', 'OPTFUT'].includes(instrument)) {
      payload.expiryCode = expiryCode;
    }
    
    // Add Open Interest flag if requested
    if (oi !== undefined) {
      payload.oi = oi;
    }
    
    console.log('[DhanHistorical] Sending request to Dhan API:', payload);
    
    const response = await axios.post(url, payload, {
      headers: {
        'access-token': config.dhan.token,
        'client-id': config.dhan.clientId,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log('[DhanHistorical] Received response status:', response.status);
    console.log('[DhanHistorical] Full response structure:', JSON.stringify(response.data, null, 2));
    console.log('[DhanHistorical] Response data keys:', Object.keys(response.data || {}));
    console.log('[DhanHistorical] Response data.data keys:', Object.keys(response.data?.data || {}));

    // Transform Dhan response to ApexCharts format
    return transformDhanToCandles(response.data);
    
  } catch (error) {
    console.error('[DhanHistorical] API Error:', {
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
      throw new Error('Historical data not found for the specified instrument.');
    }
    
    throw new Error(`Failed to fetch historical data: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Transform Dhan's response format to candle array format
 * Dhan API returns parallel arrays: { open: [], high: [], low: [], close: [], volume: [], timestamp: [], open_interest: [] }
 * @param {Object} dhanData - Dhan API response with parallel arrays
 * @returns {Array} Array of [timestamp, open, high, low, close, volume]
 */
function transformDhanToCandles(dhanData) {
  console.log('[DhanHistorical] Transforming data. Type:', typeof dhanData);
  console.log('[DhanHistorical] Data structure:', JSON.stringify(dhanData).substring(0, 500));

  // Validate response structure - Dhan API returns object with parallel arrays
  if (!dhanData || typeof dhanData !== 'object') {
    console.error('[DhanHistorical] Invalid response structure:', dhanData);
    throw new Error('Invalid response from Dhan API - expected object with array properties');
  }

  // Extract the parallel arrays
  const { open, high, low, close, volume, timestamp } = dhanData;

  // Validate all required arrays exist
  if (!Array.isArray(timestamp) || !Array.isArray(open) || !Array.isArray(high) || 
      !Array.isArray(low) || !Array.isArray(close) || !Array.isArray(volume)) {
    console.error('[DhanHistorical] Missing required arrays in response:', Object.keys(dhanData));
    throw new Error('Invalid response from Dhan API - missing required data arrays (open, high, low, close, volume, timestamp)');
  }

  // Validate all arrays have the same length
  const length = timestamp.length;
  if (open.length !== length || high.length !== length || low.length !== length || 
      close.length !== length || volume.length !== length) {
    console.error('[DhanHistorical] Array length mismatch:', {
      timestamp: timestamp.length,
      open: open.length,
      high: high.length,
      low: low.length,
      close: close.length,
      volume: volume.length
    });
    throw new Error('Invalid response from Dhan API - array length mismatch');
  }

  if (length === 0) {
    console.error('[DhanHistorical] Empty data arrays');
    throw new Error('No historical data available for the specified period');
  }
  
  console.log('[DhanHistorical] Processing', length, 'data points');
  console.log('[DhanHistorical] First data point:', {
    timestamp: timestamp[0],
    open: open[0],
    high: high[0],
    low: low[0],
    close: close[0],
    volume: volume[0]
  });

  const candles = [];
  
  // Transform parallel arrays into candle format
  for (let i = 0; i < length; i++) {
    const ts = timestamp[i] * 1000; // Convert Unix timestamp (seconds) to milliseconds
    candles.push([
      ts,
      open[i] || 0,
      high[i] || 0,
      low[i] || 0,
      close[i] || 0,
      volume[i] || 0
    ]);
  }
  
  console.log('[DhanHistorical] Transformed', candles.length, 'candles');
  console.log('[DhanHistorical] First candle:', candles[0]);
  console.log('[DhanHistorical] Last candle:', candles[candles.length - 1]);
  
  return candles;
}

/**
 * Map instrument segment and type to Dhan instrument type
 * Note: Database already stores Dhan format (FUTSTK, OPTSTK, FUTCOM, OPTFUT, etc.)
 * This function just validates and returns the correct type
 *
 * Valid Dhan instrument types:
 * - EQUITY (NSE_EQ, BSE_EQ)
 * - FUTIDX, OPTIDX (NSE_INDEX)
 * - FUTSTK, OPTSTK (NSE_FNO)
 * - FUTCOM, OPTFUT (MCX_COMM)
 *
 * @param {string} segment - Exchange segment (NSE_EQ, NSE_FNO, NSE_INDEX, MCX_COMM, etc.)
 * @param {string} instrumentType - Instrument type from database (already in Dhan format)
 * @returns {string} Dhan instrument type
 */
export function mapSegmentToInstrumentType(segment, instrumentType) {
  // List of all valid Dhan instrument types
  const validDhanTypes = ['EQUITY', 'FUTIDX', 'OPTIDX', 'FUTSTK', 'OPTSTK', 'FUTCOM', 'OPTFUT'];

  // If instrumentType is already a valid Dhan type, return it directly
  if (validDhanTypes.includes(instrumentType)) {
    console.log('[DhanHistorical] Using instrumentType from database:', instrumentType);
    return instrumentType;
  }

  // Handle legacy EQ type → EQUITY
  if (instrumentType === 'EQ') {
    console.log('[DhanHistorical] Converting EQ → EQUITY');
    return 'EQUITY';
  }

  // For equity segments, default to EQUITY
  if (segment === 'NSE_EQ' || segment === 'BSE_EQ') {
    console.log('[DhanHistorical] Equity segment, using EQUITY');
    return 'EQUITY';
  }

  // For index segment without type
  if ((segment === 'NSE_INDEX' || segment === 'IDX_I') && !instrumentType) {
    console.log('[DhanHistorical] Index segment without type, using EQUITY');
    return 'EQUITY';
  }

  // Unknown or invalid instrumentType
  console.error('[DhanHistorical] Invalid or unknown instrumentType:', { segment, instrumentType });
  console.error('[DhanHistorical] Valid types are:', validDhanTypes);
  throw new Error(`Invalid instrumentType: ${instrumentType}. Expected one of: ${validDhanTypes.join(', ')}`);
}

/**
 * Fetch intraday OHLC data from Dhan API (Minute candles: 1, 5, 15, 25, 60 min)
 * Max 90 days of data can be fetched at once
 * @param {Object} params - { securityId, exchangeSegment, instrument, interval, fromDate, toDate, oi }
 * @returns {Promise<Array>} Array of [timestamp, open, high, low, close, volume]
 */
export async function getDhanIntradayData(params) {
  const { securityId, exchangeSegment, instrument, interval, fromDate, toDate, oi } = params;
  
  try {
    console.log('[DhanIntraday] Fetching data:', { securityId, exchangeSegment, instrument, interval, fromDate, toDate });
    
    // Validate interval
    const validIntervals = [1, 5, 15, 25, 60];
    const numInterval = Number(interval);
    if (!validIntervals.includes(numInterval)) {
      throw new Error(`Invalid interval: ${interval}. Must be one of: ${validIntervals.join(', ')}`);
    }
    
    // Dhan API endpoint for intraday data
    const url = 'https://api.dhan.co/v2/charts/intraday';
    
    const payload = {
      securityId: String(securityId),
      exchangeSegment: exchangeSegment,
      instrument: instrument,
      interval: numInterval, // Send as number, not string
      fromDate: fromDate, // Format: "YYYY-MM-DD HH:MM:SS"
      toDate: toDate       // Format: "YYYY-MM-DD HH:MM:SS"
    };
    
    // Add Open Interest flag if requested
    if (oi !== undefined) {
      payload.oi = oi;
    }
    
    console.log('[DhanIntraday] Sending request to Dhan API:', JSON.stringify(payload, null, 2));
    console.log('[DhanIntraday] Request URL:', url);
    
    const response = await axios.post(url, payload, {
      headers: {
        'access-token': config.dhan.token,
        'client-id': config.dhan.clientId,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000 // 15 second timeout (intraday data can be large)
    });
    
    console.log('[DhanIntraday] Received response status:', response.status);
    console.log('[DhanIntraday] Data points received:', response.data?.timestamp?.length || 0);

    // Transform Dhan response to ApexCharts format
    return transformDhanToCandles(response.data);
    
  } catch (error) {
    console.error('[DhanIntraday] API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      requestPayload: {
        securityId,
        exchangeSegment,
        instrument,
        interval,
        fromDate,
        toDate
      }
    });
    
    // Provide more specific error messages
    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please check Dhan access token.');
    } else if (error.response?.status === 400) {
      throw new Error(`Invalid request: ${error.response?.data?.message || 'Bad parameters'}`);
    } else if (error.response?.status === 404) {
      throw new Error('Intraday data not found for the specified instrument.');
    }
    
    throw new Error(`Failed to fetch intraday data: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Format date to YYYY-MM-DD format required by Dhan (for daily data)
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted date string
 */
export function formatDateForDhan(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date to "YYYY-MM-DD HH:MM:SS" format required by Dhan (for intraday data)
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted date string with time
 */
export function formatDateTimeForDhan(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

