// Backend/Controllers/ChartController.js
import { 
  getDhanHistoricalData, 
  getDhanIntradayData,
  mapSegmentToInstrumentType, 
  formatDateForDhan,
  formatDateTimeForDhan 
} from '../services/dhanHistorical.js';
import Instrument from '../Model/InstrumentModel.js';

/**
 * Get historical candle data from Dhan
 * Query params:
 *   - symbol: tradingSymbol or "segment|securityId" format
 *   - from: Start date (YYYY-MM-DD)
 *   - to: End date (YYYY-MM-DD)
 *   - interval: Time interval (optional, default: 5) - currently not used by Dhan
 */
async function getChartData(req, res) {
  try {
    const { symbol, from, to, interval = '5' } = req.query;

    // Validate required parameters
    if (!symbol || !from || !to) {
      return res.status(400).json({
        error: 'Missing required parameters',
        details: 'symbol, from, and to are required. Format: from=YYYY-MM-DD&to=YYYY-MM-DD'
      });
    }

    console.log('[ChartController] Request received:', { symbol, from, to, interval });

    // Parse symbol to get securityId, segment, and instrumentType
    let securityId, segment, instrumentType, tradingSymbol;

    if (symbol.includes('|')) {
      // Format: "NSE_FNO|58071"
      [segment, securityId] = symbol.split('|');
      tradingSymbol = symbol;
      console.log('[ChartController] Parsed pipe format:', { segment, securityId });

      console.log('[ChartController] Looking up instrument by securityId:', securityId);

      const instrument = await Instrument.findOne({
        securityId: String(securityId),
        segment: segment
      }).lean();

      if (!instrument) {
        console.error('[ChartController] Instrument not found for securityId:', securityId);
        return res.status(404).json({
          error: 'Instrument not found',
          details: `No instrument found with securityId: ${securityId} and segment: ${segment}`
        });
      }

      instrumentType = instrument.instrumentType;
      tradingSymbol = instrument.tradingsymbol || symbol;

      console.log('[ChartController] Found instrument:', {
        securityId,
        segment,
        instrumentType,
        tradingSymbol
      });
    } else {
      // Look up in database by tradingSymbol
      console.log('[ChartController] Looking up instrument by tradingSymbol:', symbol);

      const instrument = await Instrument.findOne({
        tradingsymbol: { $regex: new RegExp(`^${symbol}$`, 'i') }
      }).lean();

      if (!instrument) {
        console.error('[ChartController] Instrument not found:', symbol);
        return res.status(404).json({
          error: 'Instrument not found',
          details: `No instrument found with trading symbol: ${symbol}`
        });
      }

      securityId = instrument.securityId;
      segment = instrument.segment;
      instrumentType = instrument.instrumentType;
      tradingSymbol = instrument.tradingsymbol;

      console.log('[ChartController] Found instrument:', {
        securityId,
        segment,
        instrumentType,
        tradingSymbol
      });
    }

    // Validate and format dates
    const fromDate = formatDateForDhan(from);
    const toDate = formatDateForDhan(to);

    console.log('[ChartController] Formatted dates:', { fromDate, toDate });

    // Map to Dhan instrument type
    const dhanInstrument = mapSegmentToInstrumentType(segment, instrumentType);

    console.log('[ChartController] Mapped to Dhan instrument type:', dhanInstrument);

    // Fetch from Dhan API
    const candles = await getDhanHistoricalData({
      securityId,
      exchangeSegment: segment,
      instrument: dhanInstrument,
      fromDate: fromDate,
      toDate: toDate,
      expiryCode: 0 // Default to current week/month for F&O
    });

    // Check if we got data
    if (!candles || candles.length === 0) {
      console.warn('[ChartController] No candles returned from Dhan');
      return res.json({
        ok: true,
        data: {
          candles: [],
          message: 'No data available for the specified period'
        }
      });
    }

    console.log('[ChartController] Successfully fetched', candles.length, 'candles');

    // Return in expected format for frontend
    return res.json({
      ok: true,
      data: {
        candles: candles,
        meta: {
          symbol: tradingSymbol,
          securityId,
          segment,
          from: fromDate,
          to: toDate,
          count: candles.length
        }
      }
    });

  } catch (error) {
    console.error('[ChartController] Error:', error);

    // Return user-friendly error
    return res.status(500).json({
      error: 'Failed to fetch chart data',
      details: error.message,
      hint: 'Please check if the instrument exists and dates are valid (YYYY-MM-DD format)'
    });
  }
}

/**
 * Get intraday candle data from Dhan (1, 5, 15, 25, 60 minute intervals)
 * Query params:
 *   - symbol: tradingSymbol or "segment|securityId" format
 *   - from: Start datetime (YYYY-MM-DD HH:MM:SS or ISO string)
 *   - to: End datetime (YYYY-MM-DD HH:MM:SS or ISO string)
 *   - interval: Time interval in minutes (1, 5, 15, 25, or 60) - default: 5
 *   - oi: Include Open Interest (optional, boolean)
 * Note: Maximum 90 days of data can be fetched at once
 */
async function getIntradayData(req, res) {
  try {
    const { symbol, from, to, interval = '5', oi = 'false' } = req.query;

    // Validate required parameters
    if (!symbol || !from || !to) {
      return res.status(400).json({
        error: 'Missing required parameters',
        details: 'symbol, from, and to are required. Format: from=YYYY-MM-DD HH:MM:SS&to=YYYY-MM-DD HH:MM:SS'
      });
    }

    // Validate interval
    const validIntervals = ['1', '5', '15', '25', '60'];
    if (!validIntervals.includes(String(interval))) {
      return res.status(400).json({
        error: 'Invalid interval',
        details: `interval must be one of: ${validIntervals.join(', ')} minutes`
      });
    }

    console.log('[ChartController] Intraday request received:', { symbol, from, to, interval, oi });

    // Parse symbol to get securityId, segment, and instrumentType
    let securityId, segment, instrumentType, tradingSymbol;

    if (symbol.includes('|')) {
      // Format: "NSE_FNO|58071"
      [segment, securityId] = symbol.split('|');
      tradingSymbol = symbol;
      console.log('[ChartController] Parsed pipe format:', { segment, securityId });

      const instrument = await Instrument.findOne({
        securityId: String(securityId),
        segment: segment
      }).lean();

      if (!instrument) {
        console.error('[ChartController] Instrument not found for securityId:', securityId);
        return res.status(404).json({
          error: 'Instrument not found',
          details: `No instrument found with securityId: ${securityId} and segment: ${segment}`
        });
      }

      instrumentType = instrument.instrumentType;
      tradingSymbol = instrument.tradingsymbol || symbol;

      console.log('[ChartController] Found instrument:', {
        securityId,
        segment,
        instrumentType,
        tradingSymbol
      });
    } else {
      // Look up in database by tradingSymbol
      console.log('[ChartController] Looking up instrument by tradingSymbol:', symbol);

      const instrument = await Instrument.findOne({
        tradingsymbol: { $regex: new RegExp(`^${symbol}$`, 'i') }
      }).lean();

      if (!instrument) {
        console.error('[ChartController] Instrument not found:', symbol);
        return res.status(404).json({
          error: 'Instrument not found',
          details: `No instrument found with trading symbol: ${symbol}`
        });
      }

      securityId = instrument.securityId;
      segment = instrument.segment;
      instrumentType = instrument.instrumentType;
      tradingSymbol = instrument.tradingsymbol;

      console.log('[ChartController] Found instrument:', {
        securityId,
        segment,
        instrumentType,
        tradingSymbol
      });
    }

    // Validate and format dates - handle both ISO and "YYYY-MM-DD HH:MM:SS" formats
    let fromDate, toDate;
    
    try {
      // If from/to are already in correct format, use them; otherwise parse and format
      if (from.includes('T') || from.length === 10) {
        fromDate = formatDateTimeForDhan(from);
      } else {
        fromDate = from; // Already in "YYYY-MM-DD HH:MM:SS" format
      }
      
      if (to.includes('T') || to.length === 10) {
        toDate = formatDateTimeForDhan(to);
      } else {
        toDate = to; // Already in "YYYY-MM-DD HH:MM:SS" format
      }
    } catch (err) {
      return res.status(400).json({
        error: 'Invalid date format',
        details: 'Dates must be in "YYYY-MM-DD HH:MM:SS" or ISO format'
      });
    }

    console.log('[ChartController] Formatted dates:', { fromDate, toDate });

    // Validate 90-day limit
    const fromTimestamp = new Date(fromDate).getTime();
    const toTimestamp = new Date(toDate).getTime();
    const daysDiff = (toTimestamp - fromTimestamp) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 90) {
      return res.status(400).json({
        error: 'Date range too large',
        details: 'Maximum 90 days of intraday data can be fetched at once. Please reduce the date range.'
      });
    }

    // Map to Dhan instrument type
    const dhanInstrument = mapSegmentToInstrumentType(segment, instrumentType);

    console.log('[ChartController] Mapped to Dhan instrument type:', dhanInstrument);

    // Fetch from Dhan API
    const candles = await getDhanIntradayData({
      securityId,
      exchangeSegment: segment,
      instrument: dhanInstrument,
      interval: Number(interval),
      fromDate: fromDate,
      toDate: toDate,
      oi: oi === 'true' || oi === true
    });

    // Check if we got data
    if (!candles || candles.length === 0) {
      console.warn('[ChartController] No candles returned from Dhan');
      return res.json({
        ok: true,
        data: {
          candles: [],
          message: 'No data available for the specified period'
        }
      });
    }

    console.log('[ChartController] Successfully fetched', candles.length, 'intraday candles');

    // Return in expected format for frontend
    return res.json({
      ok: true,
      data: {
        candles: candles,
        meta: {
          symbol: tradingSymbol,
          securityId,
          segment,
          interval: `${interval}m`,
          from: fromDate,
          to: toDate,
          count: candles.length
        }
      }
    });

  } catch (error) {
    console.error('[ChartController] Intraday error:', error);

    // Return user-friendly error
    return res.status(500).json({
      error: 'Failed to fetch intraday chart data',
      details: error.message,
      hint: 'Please check if the instrument exists and dates are valid (YYYY-MM-DD HH:MM:SS format)'
    });
  }
}

export { getChartData, getIntradayData };
