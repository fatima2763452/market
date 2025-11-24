// TradingChart.jsx - Professional trading chart using TradingView Lightweight Charts
import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { useMarketData } from '../../contexts/MarketDataContext.jsx';

/**
 * Transform Dhan API candle format to Lightweight Charts format
 * From: [timestamp, open, high, low, close, volume]
 * To: { time: unixSeconds, open, high, low, close }
 */
function transformCandles(rawCandles) {
  return rawCandles.map(([timestamp, open, high, low, close, volume]) => ({
    time: Math.floor(timestamp / 1000), // Convert ms to seconds
    open: parseFloat(open),
    high: parseFloat(high),
    low: parseFloat(low),
    close: parseFloat(close),
    volume: parseFloat(volume)
  }));
}

function TradingChart({ 
  candles = [], 
  symbol, 
  interval, 
  isLiveEnabled = false,
  loading = false 
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const resizeObserverRef = useRef(null);
  
  const { ticks, isConnected } = useMarketData();
  const [lastCandleTime, setLastCandleTime] = useState(null);
  const lastUpdateRef = useRef(0); // Throttle updates

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    try {
      // Create chart with dark theme
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
        layout: {
          background: { color: '#1A1F30' },
          textColor: '#cccccc',
        },
        grid: {
          vertLines: { color: '#2B2B43' },
          horzLines: { color: '#2B2B43' },
        },
        crosshair: {
          mode: 0, // Normal mode
          vertLine: {
            width: 1,
            color: '#758696',
            style: 1,
            labelBackgroundColor: '#4682B4',
          },
          horzLine: {
            width: 1,
            color: '#758696',
            style: 1,
            labelBackgroundColor: '#4682B4',
          },
        },
        rightPriceScale: {
          borderColor: '#2B2B43',
          scaleMargins: {
            top: 0.1,
            bottom: 0.2,
          },
        },
        timeScale: {
          borderColor: '#2B2B43',
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          axisPressedMouseMove: {
            time: true,
            price: true,
          },
          mouseWheel: true,
          pinch: true,
        },
      });

      console.log('[TradingChart] Chart created successfully');

      // Add candlestick series - v5.x uses addSeries with series type definition
      const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00B746',
      downColor: '#EF403C',
      borderDownColor: '#EF403C',
      borderUpColor: '#00B746',
      wickDownColor: '#EF403C',
      wickUpColor: '#00B746',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    // Add volume series (histogram)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const { width, height } = chartContainerRef.current.getBoundingClientRect();
        chartRef.current.applyOptions({ 
          width: width,
          height: height 
        });
      }
    };

    // Use ResizeObserver for better responsiveness
    resizeObserverRef.current = new ResizeObserver(handleResize);
    resizeObserverRef.current.observe(chartContainerRef.current);

    // Initial resize
    handleResize();

    } catch (error) {
      console.error('[TradingChart] Error initializing chart:', error);
    }

    // Cleanup
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // Load historical candles
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !candles || candles.length === 0) return;

    try {
      const transformedCandles = transformCandles(candles);
      
      // Set candle data
      candleSeriesRef.current.setData(transformedCandles);
      
      // Set volume data with colors
      const volumeData = transformedCandles.map(candle => ({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? '#00B74680' : '#EF403C80'
      }));
      volumeSeriesRef.current.setData(volumeData);

      // Fit content to view
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }

      // Store last candle time for live updates
      if (transformedCandles.length > 0) {
        const lastCandle = transformedCandles[transformedCandles.length - 1];
        setLastCandleTime(lastCandle.time);
      }
    } catch (error) {
      console.error('[TradingChart] Error loading candles:', error);
    }
  }, [candles]);

  // Process live ticks (THROTTLED, direct chart updates)
  useEffect(() => {
    if (!isLiveEnabled || !isConnected || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (!symbol || !lastCandleTime) return;

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

    // THROTTLE: Max 1 update per second
    const now = Date.now();
    if (now - lastUpdateRef.current < 1000) return;
    lastUpdateRef.current = now;

    try {
      const intervalMs = Number(interval) * 60 * 1000;
      const currentTime = Math.floor(Date.now() / 1000);
      const timeSinceLastCandle = (currentTime - lastCandleTime) * 1000; // Convert back to ms

      if (timeSinceLastCandle < intervalMs) {
        // Update existing candle using chart's update method
        // Lightweight Charts will handle the merging automatically
        candleSeriesRef.current.update({
          time: lastCandleTime,
          open: tick.open || tick.ltp,
          high: tick.high || tick.ltp,
          low: tick.low || tick.ltp,
          close: tick.ltp
        });

        // Update volume
        if (tick.volume) {
          volumeSeriesRef.current.update({
            time: lastCandleTime,
            value: tick.volume,
            color: tick.ltp >= (tick.open || tick.ltp) ? '#00B74680' : '#EF403C80'
          });
        }
      } else if (timeSinceLastCandle >= intervalMs && timeSinceLastCandle < intervalMs * 2) {
        // Create new candle
        const newCandleTime = lastCandleTime + Math.floor(intervalMs / 1000);
        
        candleSeriesRef.current.update({
          time: newCandleTime,
          open: tick.ltp,
          high: tick.ltp,
          low: tick.ltp,
          close: tick.ltp
        });

        volumeSeriesRef.current.update({
          time: newCandleTime,
          value: tick.volume || 0,
          color: '#00B74680'
        });

        setLastCandleTime(newCandleTime);
        console.log('[TradingChart] New candle created at', new Date(newCandleTime * 1000));
      }
    } catch (error) {
      console.error('[TradingChart] Error processing live tick:', error);
    }
  }, [ticks, symbol, interval, isLiveEnabled, isConnected, lastCandleTime]);

  if (loading) {
    return (
      <div 
        ref={chartContainerRef}
        className="relative w-full h-full flex items-center justify-center bg-[#1A1F30] rounded-lg"
        style={{ minHeight: '400px' }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <p className="text-gray-400 text-sm">Loading chart...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={chartContainerRef}
      className="relative w-full h-full bg-[#1A1F30] rounded-lg"
      style={{ 
        minHeight: '400px'
      }}
    />
  );
}

export default TradingChart;
