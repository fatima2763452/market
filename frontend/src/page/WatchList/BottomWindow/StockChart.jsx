// Chart.jsx — Full Working TradingView-Style Chart Component

import React, { useEffect, useState } from "react";
import Chart from "react-apexcharts";

// ✅ Helper to format candle data for ApexCharts
const formatCandles = (candles) =>
  candles.map(([timestamp, open, high, low, close, volume]) => ({
    x: new Date(timestamp),
    y: [open, high, low, close],
    volume,
  }));

function StockChart({ symbol }) {
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch chart data from backend
  useEffect(() => {
    // inside useEffect in StockChart.jsx -> replace fetchChartData()
    const fetchChartData = async () => {
      try {
        setLoading(true);
        setError(null);

        const today = new Date();
        const fiveDaysAgo = new Date(today);
        fiveDaysAgo.setDate(today.getDate() - 5);

        const toDate = today.toISOString().slice(0, 10);
        const fromDate = fiveDaysAgo.toISOString().slice(0, 10);

        const url = `${import.meta.env.VITE_REACT_APP_API_URL}/api/getChartData?symbol=${encodeURIComponent(
          symbol
        )}&from=${fromDate}&to=${toDate}&interval=5`;

        const res = await fetch(url);

        // IMPORTANT: check response status BEFORE trying to parse JSON
        if (!res.ok) {
          const text = await res.text().catch(() => ''); // may be HTML or message
          console.error('Chart fetch upstream error text:', text);
          throw new Error(`Chart fetch failed: ${res.status} ${res.statusText} - ${text.slice(0, 200)}`);
        }

        const json = await res.json();

        // Expecting backend to return { data: { candles: [...] } } after the route fixes
        const candleData = json?.data?.candles ?? json?.data?.ohlc ?? null;
        if (!candleData || !Array.isArray(candleData) || candleData.length === 0) {
          console.error('Invalid chart payload', json);
          throw new Error('Invalid API response: no candles');
        }

        const formatted = formatCandles(candleData);
        setCandles(formatted);
      } catch (err) {
        console.error('Chart fetch error:', err);
        setError('Failed to load chart data');
      } finally {
        setLoading(false);
      }
    };


    fetchChartData();
  }, [symbol]);

  // Separate volume for secondary chart
  const volumeSeries = candles.map((c) => ({
    x: c.x,
    y: c.volume,
  }));

  // --- ApexCharts Config ---
  const candleOptions = {
    chart: {
      type: "candlestick",
      background: "#1A1F30",
      foreColor: "#ccc",
      height: 400,
      toolbar: { show: true, tools: { download: true, zoom: true } },
    },
    title: {
      text: `Price Chart (${symbol.split("|")[1]})`,
      align: "left",
      style: { color: "#fff", fontWeight: 600 },
    },
    xaxis: {
      type: "datetime",
      labels: { style: { colors: "#aaa" } },
    },
    yaxis: {
      tooltip: { enabled: true },
      labels: { style: { colors: "#aaa" } },
    },
    grid: {
      borderColor: "#333",
      strokeDashArray: 3,
    },
    tooltip: {
      theme: "dark",
      x: { show: true },
    },
  };

  const volumeOptions = {
    chart: {
      type: "bar",
      background: "#1A1F30",
      foreColor: "#ccc",
      height: 150,
      toolbar: { show: false },
      animations: { enabled: false },
    },
    plotOptions: {
      bar: { columnWidth: "80%", borderRadius: 2 },
    },
    xaxis: {
      type: "datetime",
      labels: { show: false },
    },
    yaxis: {
      labels: { style: { colors: "#aaa" } },
    },
    grid: {
      borderColor: "#333",
    },
  };

  if (loading)
    return (
      <div className="p-4 text-center text-gray-400 bg-[#1A1F30] rounded-lg">
        Loading chart data...
      </div>
    );

  if (error)
    return (
      <div className="p-4 text-center text-red-400 bg-[#1A1F30] rounded-lg">
        {error}
      </div>
    );

  return (
    <div className="bg-[#1A1F30] rounded-xl p-3 shadow-lg">
      <Chart
        options={candleOptions}
        series={[{ data: candles }]}
        type="candlestick"
        height={400}
      />
      <Chart
        options={volumeOptions}
        series={[{ name: "Volume", data: volumeSeries }]}
        type="bar"
        height={150}
      />
    </div>
  );
}

export default StockChart;
