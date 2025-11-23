// Chart.jsx — Full Working TradingView-Style Chart Component with Intraday Support

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Chart from "react-apexcharts";
import { Calendar, Clock, AlertCircle, Maximize2 } from "lucide-react";
import { useMarketData } from "../../contexts/MarketDataContext.jsx";

// ✅ Helper to format candle data for ApexCharts
const formatCandles = (candles) =>
  candles.map(([timestamp, open, high, low, close, volume]) => ({
    x: new Date(timestamp),
    y: [open, high, low, close],
    volume,
  }));

// Interval configurations with realistic defaults
const INTERVALS = [
  { label: '1m', value: '1', type: 'intraday', days: 1, maxCandles: 375 },      // ~375 candles per day
  { label: '5m', value: '5', type: 'intraday', days: 5, maxCandles: 1875 },     // ~375 candles per day
  { label: '15m', value: '15', type: 'intraday', days: 15, maxCandles: 1875 },  // ~125 candles per day
  { label: '1h', value: '60', type: 'intraday', days: 30, maxCandles: 1875 },   // ~31 candles per day
  { label: '1D', value: 'daily', type: 'daily', days: 90, maxCandles: 90 },     // Changed from 365 to 90 days
];

function StockChart({ symbol, tradingSymbol, initialInterval, initialFrom, initialTo }) {
  const [candles, setCandles] = useState([]); // Historical candles (stable)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInterval, setSelectedInterval] = useState(initialInterval || '5');
  const [dateRange, setDateRange] = useState({ from: initialFrom || '', to: initialTo || '' });
  const [isInitialized, setIsInitialized] = useState(false);
  const [liveConnectionStatus, setLiveConnectionStatus] = useState('disconnected');
  const [liveCandle, setLiveCandle] = useState(null); // Current live candle being built
  const [livePrice, setLivePrice] = useState(null); // Current price for horizontal line
  
  // Refs for tracking
  const isSubscribedRef = useRef(false);
  const candlesLoadedRef = useRef(false);
  const lastUpdateTimeRef = useRef(0); // Throttle live updates to 1 per second
  
  // Get live market data
  const { ticks, subscribe, unsubscribe, isConnected } = useMarketData();

  // Display name for chart title
  const displayName = tradingSymbol || symbol.split("|")[1] || symbol;

  // Get current interval config
  const currentInterval = INTERVALS.find(i => i.value === selectedInterval) || INTERVALS[1];

  // Calculate default date range based on interval (memoized)
  const getDefaultDateRange = useCallback((intervalConfig) => {
    const today = new Date();
    const from = new Date(today);
    
    // Use default days from interval config
    from.setDate(today.getDate() - intervalConfig.days);
    
    return {
      from: from.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10)
    };
  }, []);

  // Initialize date range ONCE on mount
  useEffect(() => {
    if (!isInitialized) {
      // Use URL params if available, otherwise use defaults
      if (!initialFrom || !initialTo) {
        const defaults = getDefaultDateRange(currentInterval);
        setDateRange(defaults);
      }
      setIsInitialized(true);
    }
  }, [isInitialized, currentInterval, getDefaultDateRange, initialFrom, initialTo]);

  // Format date for API based on interval type
  const formatDateForAPI = (date, isStartDate = false) => {
    const d = new Date(date);
    
    if (currentInterval.type === 'intraday') {
      // Intraday requires "YYYY-MM-DD HH:MM:SS" format
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      
      // Set time: 09:15:00 for start, 15:30:00 for end
      const time = isStartDate ? '09:15:00' : '15:30:00';
      return `${year}-${month}-${day} ${time}`;
    } else {
      // Daily requires "YYYY-MM-DD" format
      return date;
    }
  };

  // Validate 90-day limit for intraday
  const validateDateRange = (from, to) => {
    if (currentInterval.type === 'intraday') {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const daysDiff = (toDate - fromDate) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 90) {
        return { valid: false, message: 'Intraday data is limited to 90 days. Please select a shorter range.' };
      }
    }
    return { valid: true };
  };

  // Fetch chart data from backend (with debounce to prevent rapid re-fetches)
  useEffect(() => {
    if (!dateRange.from || !dateRange.to || !isInitialized) return;

    // Use a ref to track if this effect should run
    let isCancelled = false;

    const fetchChartData = async () => {

      try {
        setLoading(true);
        setError(null);

        // Validate date range
        const validation = validateDateRange(dateRange.from, dateRange.to);
        if (!validation.valid) {
          throw new Error(validation.message);
        }

        const fromDate = formatDateForAPI(dateRange.from, true);
        const toDate = formatDateForAPI(dateRange.to, false);

        let url;
        const baseUrl = import.meta.env.VITE_REACT_APP_API_URL || 'https://api.wolfkrypt.me';
        
        if (currentInterval.type === 'intraday') {
          // Use intraday endpoint
          url = `${baseUrl}/api/chart/getIntradayData?symbol=${encodeURIComponent(
            symbol
          )}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&interval=${selectedInterval}`;
        } else {
          // Use daily endpoint
          url = `${baseUrl}/api/chart/getChartData?symbol=${encodeURIComponent(
            symbol
          )}&from=${dateRange.from}&to=${dateRange.to}`;
        }

        console.log('[StockChart] Fetching:', url);

        const res = await fetch(url);

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.error('[StockChart] API error:', text);
          throw new Error(`Chart fetch failed: ${res.status} ${res.statusText}`);
        }

        const json = await res.json();

        const candleData = json?.data?.candles ?? json?.data?.ohlc ?? null;
        if (!candleData || !Array.isArray(candleData) || candleData.length === 0) {
          console.warn('[StockChart] No candle data returned');
          if (!isCancelled) {
            setCandles([]);
            setError('No data available for selected period');
          }
          return;
        }

        const formatted = formatCandles(candleData);
        if (!isCancelled) {
          setCandles(formatted);
          candlesLoadedRef.current = true; // Mark as loaded
          console.log('[StockChart] Loaded', formatted.length, 'candles');
        }
      } catch (err) {
        console.error('[StockChart] Fetch error:', err);
        if (!isCancelled) {
          setError(err.message || 'Failed to load chart data');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchChartData();

    // Cleanup function to cancel any pending state updates
    return () => {
      isCancelled = true;
    };
  }, [symbol, selectedInterval, dateRange.from, dateRange.to, isInitialized, currentInterval.type]);

  // Subscribe to live market data for this symbol (only for intraday charts)
  useEffect(() => {
    // Only subscribe for intraday intervals, not daily
    if (!isConnected || !symbol || currentInterval.type !== 'intraday') {
      setLiveConnectionStatus('disconnected');
      return;
    }
    
    // Don't subscribe until we have initial data loaded
    if (loading) return;
    
    // Use ref to check if candles were loaded (avoids dependency on candles state)
    if (!candlesLoadedRef.current) {
      return;
    }

    const [segment, securityId] = symbol.split('|');
    if (!segment || !securityId) return;

    // Check if already subscribed to prevent duplicate subscriptions
    if (isSubscribedRef.current) return;

    const subscription = [{
      segment: segment,
      securityId: securityId
    }];
    
    // Set connecting status
    setLiveConnectionStatus('connecting');
    
    // Subscribe to live ticks
    subscribe(subscription, 'full')
      .then(() => {
        console.log('[StockChart] Successfully subscribed to live feed');
        setLiveConnectionStatus('connected');
        isSubscribedRef.current = true;
      })
      .catch(err => {
        console.warn('[StockChart] Subscribe failed:', err);
        setLiveConnectionStatus('error');
        isSubscribedRef.current = false;
      });

    return () => {
      if (isSubscribedRef.current) {
        console.log('[StockChart] Cleaning up subscription');
        unsubscribe(subscription, 'full').catch(err => {
          console.warn('[StockChart] Unsubscribe failed:', err);
        });
        isSubscribedRef.current = false;
        setLiveConnectionStatus('disconnected');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, isConnected, currentInterval.type, loading]); // subscribe/unsubscribe are stable now

  // Process live ticks and update live candle (THROTTLED to prevent loops)
  useEffect(() => {
    // Only process for intraday, when we have historical data
    if (currentInterval.type === 'daily' || !candles || candles.length === 0) {
      setLiveCandle(null);
      setLivePrice(null);
      return;
    }

    const [segment, securityId] = symbol.split('|');
    if (!segment || !securityId) return;

    // Map segment to numeric format
    const segmentMap = {
      "IDX_I": 0, "NSE_EQ": 1, "NSE_FNO": 2, "NSE_CURRENCY": 3,
      "BSE_EQ": 4, "BSE_CURRENCY": 5, "MCX_COMM": 5, "NSE_INDEX": 0,
    };

    const numericSegment = segmentMap[segment];
    const tickKey = `${numericSegment}-${securityId}`;
    const tick = ticks.get(tickKey);

    if (!tick || !tick.ltp) return;

    // CRITICAL: Throttle updates to max 1 per second
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < 1000) {
      return; // Skip this update
    }
    lastUpdateTimeRef.current = now;

    // Update live price for annotation line
    setLivePrice(tick.ltp);

    const lastCandle = candles[candles.length - 1];
    if (!lastCandle) return;

    const lastCandleTime = lastCandle.x.getTime();
    const intervalMs = Number(selectedInterval) * 60 * 1000;
    const timeSinceLastCandle = now - lastCandleTime;
    
    if (timeSinceLastCandle < intervalMs) {
      // Update existing candle
      setLiveCandle({
        x: lastCandle.x,
        y: [
          lastCandle.y[0], // Keep original open
          Math.max(lastCandle.y[1], tick.ltp), // Update high
          Math.min(lastCandle.y[2], tick.ltp), // Update low
          tick.ltp // Update close
        ],
        volume: tick.volume || lastCandle.volume
      });
    } else if (timeSinceLastCandle >= intervalMs && timeSinceLastCandle < intervalMs * 2) {
      // Create new candle and append to historical
      const newCandleTime = new Date(lastCandleTime + intervalMs);
      const newCandle = {
        x: newCandleTime,
        y: [tick.ltp, tick.ltp, tick.ltp, tick.ltp],
        volume: tick.volume || 0
      };
      
      console.log('[StockChart] New interval started, appending completed candle');
      setCandles(prev => [...prev, newCandle]);
      setLiveCandle(null); // Reset live candle
    }
  }, [ticks, candles, symbol, selectedInterval, currentInterval.type]);

  // Merge live candle with historical data (smart merging to avoid duplicates)
  const displayCandles = useMemo(() => {
    if (!liveCandle || candles.length === 0) return candles;
    
    const lastCandle = candles[candles.length - 1];
    const lastCandleTime = lastCandle.x.getTime();
    const liveCandleTime = liveCandle.x.getTime();
    
    // If live candle updates the last historical candle (same timestamp)
    if (liveCandleTime === lastCandleTime) {
      return [...candles.slice(0, -1), liveCandle];
    }
    
    // If live candle is a new interval (shouldn't happen as we append directly)
    if (liveCandleTime > lastCandleTime) {
      return candles; // Already appended to state
    }
    
    return candles;
  }, [candles, liveCandle]);

  // --- ApexCharts Config (Memoized to prevent zoom reset) ---
  const candleOptions = useMemo(() => {
    const options = {
    chart: {
      id: 'stock-candlestick-chart',
      type: "candlestick",
      background: "#1A1F30",
      foreColor: "#ccc",
      height: 400,
      toolbar: { 
        show: true, 
        tools: { 
          download: true, 
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        } 
      },
      zoom: {
        enabled: true,
        type: 'x',
        autoScaleYaxis: true
      },
      selection: {
        enabled: true,
        type: 'x'
      },
      events: {
        beforeZoom: function(chartContext, { xaxis }) {
          return { xaxis };
        }
      },
      animations: {
        enabled: false,
        dynamicAnimation: {
          enabled: false
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    title: {
      text: `${displayName} (${currentInterval.label})`,
      align: "left",
      style: { color: "#fff", fontWeight: 600, fontSize: '16px' },
    },
    xaxis: {
      type: "datetime",
      labels: { 
        style: { colors: "#aaa" },
        datetimeFormatter: {
          year: 'yyyy',
          month: 'MMM \'yy',
          day: 'dd MMM',
          hour: 'HH:mm'
        }
      },
    },
    yaxis: {
      tooltip: { enabled: true },
      labels: { 
        style: { colors: "#aaa" },
        formatter: (val) => `₹${val?.toFixed(2) || 0}`
      },
      opposite: true // Price labels on right side
    },
    tooltip: {
      enabled: true,
      theme: 'dark',
      custom: function({ seriesIndex, dataPointIndex, w }) {
        const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
        if (!data) return '';
        
        const o = data.y[0];
        const h = data.y[1];
        const l = data.y[2];
        const c = data.y[3];
        const isUp = c >= o;
        const color = isUp ? '#00B746' : '#EF403C';
        
        return `
          <div class="bg-[#1A1F30] border border-gray-700 rounded p-2 text-xs">
            <div class="font-semibold mb-1" style="color: ${color}">${new Date(data.x).toLocaleString()}</div>
            <div class="grid grid-cols-2 gap-x-3 gap-y-1">
              <span class="text-gray-400">Open:</span><span class="text-white">₹${o.toFixed(2)}</span>
              <span class="text-gray-400">High:</span><span class="text-green-400">₹${h.toFixed(2)}</span>
              <span class="text-gray-400">Low:</span><span class="text-red-400">₹${l.toFixed(2)}</span>
              <span class="text-gray-400">Close:</span><span class="text-white">₹${c.toFixed(2)}</span>
            </div>
          </div>
        `;
      }
    },
    grid: {
      borderColor: "#333",
      strokeDashArray: 2
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#00B746',
          downward: '#EF403C'
        },
        wick: {
          useFillColor: true
        }
      }
    },
    states: {
      active: {
        filter: {
          type: 'none' // Prevents color change on zoom/interaction
        }
      }
    }
  };
  
  return options;
}, [displayName, currentInterval.label, currentInterval.type]);

  // Handle interval change
  const handleIntervalChange = (interval) => {
    if (interval === selectedInterval) return; // Prevent unnecessary updates
    
    setSelectedInterval(interval);
    setCandles([]); // Clear old candles immediately
    setLiveCandle(null); // Clear live candle
    setLivePrice(null); // Clear live price line
    candlesLoadedRef.current = false; // Reset loaded flag
    setLoading(true);
    
    // Get new interval config and set appropriate date range
    const newInterval = INTERVALS.find(i => i.value === interval) || INTERVALS[1];
    const defaults = getDefaultDateRange(newInterval);
    setDateRange(defaults);
  };

  // Handle date change
  const handleDateChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading)
    return (
      <div className="p-4 text-center text-gray-400 bg-[#1A1F30] rounded-lg min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <p>Loading chart data...</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="p-4 text-center bg-[#1A1F30] rounded-lg min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-red-400 font-semibold">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );

  return (
    <div className="bg-[#1A1F30] rounded-xl p-3 shadow-lg space-y-3">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-white/10">
        {/* Interval Selector */}
        <div className="flex items-center gap-1 bg-[#0E1324] rounded-lg p-1">
          <Clock className="w-4 h-4 text-gray-400 ml-1" />
          {INTERVALS.map((interval) => (
            <button
              key={interval.value}
              onClick={() => handleIntervalChange(interval.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                selectedInterval === interval.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {interval.label}
            </button>
          ))}
        </div>

        {/* Date Range Picker */}
        <div className="flex items-center gap-2 bg-[#0E1324] rounded-lg p-2 flex-1 min-w-[280px]">
          <Calendar className="w-4 h-4 text-gray-400" />
          <div className="flex items-center gap-2 text-xs flex-1">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => handleDateChange('from', e.target.value)}
              max={dateRange.to}
              className="bg-transparent text-gray-300 border border-white/10 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => handleDateChange('to', e.target.value)}
              min={dateRange.from}
              max={new Date().toISOString().slice(0, 10)}
              className="bg-transparent text-gray-300 border border-white/10 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Info Badge */}
        {currentInterval.type === 'intraday' && (
          <div className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded border border-yellow-400/20">
            Max 90 days for intraday
          </div>
        )}
        
        {/* Fullscreen Toggle */}
        <button
          onClick={() => {
            const chartContainer = document.querySelector('.chart-container');
            if (chartContainer) {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                chartContainer.requestFullscreen();
              }
            }
          }}
          title="Toggle Fullscreen"
          className="p-2 bg-[#0E1324] text-gray-400 rounded-lg hover:text-white hover:bg-white/5 transition ml-auto"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Chart Container with fullscreen support */}
      <div className="chart-container space-y-3">
      {/* Live Connection Status Badge */}
      {currentInterval.type === 'intraday' && (
        <div className="flex items-center justify-center gap-2 py-1">
          {liveConnectionStatus === 'connected' && (
            <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 px-3 py-1 rounded-full border border-green-400/30">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="font-semibold">LIVE</span>
            </div>
          )}
          {liveConnectionStatus === 'connecting' && (
            <div className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/30">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-spin"></span>
              <span className="font-semibold">CONNECTING...</span>
            </div>
          )}
          {liveConnectionStatus === 'error' && (
            <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-400/10 px-3 py-1 rounded-full border border-red-400/30">
              <span className="w-2 h-2 bg-red-400 rounded-full"></span>
              <span className="font-semibold">CONNECTION ERROR</span>
            </div>
          )}
          {liveConnectionStatus === 'disconnected' && isConnected && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-400/10 px-3 py-1 rounded-full border border-gray-400/30">
              <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
              <span className="font-semibold">HISTORICAL DATA</span>
            </div>
          )}
        </div>
      )}
      {/* Candlestick Chart */}
      <Chart
        key={`candle-${symbol}-${selectedInterval}`}
        options={candleOptions}
        series={[{ data: displayCandles }]}
        type="candlestick"
        height={400}
      />

      {/* Data Info */}
      <div className="text-xs text-gray-500 text-center pt-2 border-t border-white/10">
        Showing {displayCandles.length} candles • {currentInterval.label} interval
        {liveCandle && currentInterval.type === 'intraday' && (
          <span className="text-green-400 ml-2">• Live updating</span>
        )}
        {candles.length >= currentInterval.maxCandles && (
          <span className="text-yellow-400 ml-2">
            ⚠️ Large dataset may affect performance
          </span>
        )}
      </div>
      </div>
    </div>
  );
}

export default StockChart;
