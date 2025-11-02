// src/page/Portfolio/Portfolio.jsx
import React, { useEffect, useRef, useState } from "react";
import { BarChart, Zap } from "lucide-react";

/* ---------------- Dummy Holdings (your data) ---------------- */
const DUMMY_HOLDINGS_DATA = [
  { id: "HDFC1", tradingsymbol: "HDFCBANK", quantity: 50,  avgPrice: 1450.0, ltp: 1485.5, dayPnl: 175.0,   dayPnlPercent: 0.24, totalPnl: 1775.0, totalPnlPercent: 2.45 },
  { id: "TCS2",  tradingsymbol: "TCS",      quantity: 20,  avgPrice: 3800.0, ltp: 3750.5, dayPnl: -100.0,  dayPnlPercent: -0.13, totalPnl: -990.0, totalPnlPercent: -1.3 },
  { id: "RELI3", tradingsymbol: "RELIANCE", quantity: 10,  avgPrice: 2400.0, ltp: 2425.0, dayPnl: 50.0,    dayPnlPercent: 0.21, totalPnl: 250.0,  totalPnlPercent: 1.04 },
  { id: "INFY4", tradingsymbol: "INFY",     quantity: 100, avgPrice: 1550.0, ltp: 1555.25,dayPnl: 5.25,   dayPnlPercent: 0.03, totalPnl: 525.0,  totalPnlPercent: 0.34 },
  { id: "SUNP5", tradingsymbol: "SUNPHARMA",quantity: 30,  avgPrice: 1100.0, ltp: 1120.1, dayPnl: 60.3,    dayPnlPercent: 0.18, totalPnl: 603.0,  totalPnlPercent: 1.83 },
  { id: "MARU6", tradingsymbol: "MARUTI",   quantity: 5,   avgPrice: 9000.0, ltp: 9100.0, dayPnl: 500.0,   dayPnlPercent: 0.55, totalPnl: 500.0,  totalPnlPercent: 0.55 },
  { id: "TAT7",  tradingsymbol: "TATAPOW",  quantity: 200, avgPrice: 250.0,  ltp: 255.0,  dayPnl: 1000.0,  dayPnlPercent: 2.0,  totalPnl: 1000.0, totalPnlPercent: 2.0 },
  { id: "SBI8",  tradingsymbol: "SBIN",     quantity: 70,  avgPrice: 600.0,  ltp: 605.0,  dayPnl: 350.0,   dayPnlPercent: 0.83, totalPnl: 350.0,  totalPnlPercent: 0.83 },
  { id: "AXI9",  tradingsymbol: "AXISBANK", quantity: 150, avgPrice: 900.0,  ltp: 915.0,  dayPnl: 2250.0,  dayPnlPercent: 1.67, totalPnl: 2250.0, totalPnlPercent: 1.67 },
  { id: "WIP10", tradingsymbol: "WIPRO",    quantity: 400, avgPrice: 400.0,  ltp: 403.0,  dayPnl: 1200.0,  dayPnlPercent: 0.75, totalPnl: 1200.0, totalPnlPercent: 0.75 },
];

/* ---------------- Small helpers ---------------- */
const fmt = (n) => `₹${Number(n ?? 0).toFixed(2)}`;
const signColor = (n) => (Number(n) >= 0 ? "text-green-400" : "text-red-400");
const signSym = (n) => (Number(n) >= 0 ? "+" : "");

/* ---------------- Holding card ---------------- */
const HoldingItem = ({ h }) => {
  const dayColor = signColor(h.dayPnl);
  const totColor = signColor(h.totalPnl);

  return (
    <div className="relative bg-[#121a2b] p-4 rounded-xl shadow-md border border-white/10 hover:bg-[#172238] transition mb-3">
      {/* left purple accent */}
      <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-fuchsia-500" />

      <div className="flex justify-between items-center mb-2">
        <p className="text-base md:text-lg font-bold text-white tracking-wide">{h.tradingsymbol}</p>
        <p className={`text-sm md:text-base font-semibold ${dayColor}`}>
          {signSym(h.dayPnl)}
          {Number(h.dayPnl).toFixed(2)} (
          {signSym(h.dayPnlPercent)}
          {Number(h.dayPnlPercent).toFixed(2)}%)
        </p>
      </div>

      <div className="flex justify-between text-xs md:text-sm text-gray-300">
        <div className="space-y-1">
          <p>
            Qty: <span className="text-white font-medium">{h.quantity}</span>
          </p>
          <p>
            Avg. Price: <span className="text-white font-medium">{fmt(h.avgPrice)}</span>
          </p>
        </div>
        <div className="space-y-1 text-right">
          <p>
            LTP: <span className="text-white font-semibold">{fmt(h.ltp)}</span>
          </p>
          <p>
            Total P&L:{" "}
            <span className={`${totColor} font-semibold`}>
              {signSym(h.totalPnl)}
              {Number(h.totalPnl).toFixed(2)} (
              {signSym(h.totalPnlPercent)}
              {Number(h.totalPnlPercent).toFixed(2)}%)
            </span>
          </p>
        </div>
      </div>

      <button className="mt-2 text-fuchsia-300 hover:text-fuchsia-200 text-xs md:text-sm font-medium inline-flex items-center underline-offset-4 hover:underline">
        <BarChart className="w-4 h-4 mr-1" />
        View Chart & Details
      </button>
    </div>
  );
};

/* ---------------- Main Portfolio ---------------- */
export default function Portfolio() {
  const [pill, setPill] = useState("All"); // All | Pledge (UI only)
  const [holdings, setHoldings] = useState(DUMMY_HOLDINGS_DATA);
  const [summary, setSummary] = useState({
    invested: 0,
    current: 0,
    dayReturn: 0,
    dayReturnPercent: 0,
    totalReturn: 0,
    totalReturnPercent: 0,
  });

  const pollingRef = useRef(null);
  const POLL_INTERVAL = 10000;

  // summary compute
  useEffect(() => {
    if (!holdings?.length) {
      setSummary({
        invested: 0,
        current: 0,
        dayReturn: 0,
        dayReturnPercent: 0,
        totalReturn: 0,
        totalReturnPercent: 0,
      });
      return;
    }

    const acc = holdings.reduce(
      (a, h) => {
        a.invested += (h.quantity ?? 0) * (h.avgPrice ?? 0);
        a.current += (h.quantity ?? 0) * (h.ltp ?? 0);
        a.dayReturn += h.dayPnl ?? 0;
        return a;
      },
      { invested: 0, current: 0, dayReturn: 0 }
    );

    const totalReturn = acc.current - acc.invested;
    const totalReturnPercent = acc.invested ? (totalReturn / acc.invested) * 100 : 0;
    const dayReturnPercent = acc.invested ? (acc.dayReturn / acc.invested) * 100 : 0;

    setSummary({
      invested: acc.invested,
      current: acc.current,
      totalReturn,
      totalReturnPercent,
      dayReturn: acc.dayReturn,
      dayReturnPercent,
    });
  }, [holdings]);

  // mock polling to simulate LTP movement
  const fetchHoldings = async () => {
    const updated = holdings.map((h) => {
      const ltp = (h.ltp ?? 0) * (1 + (Math.random() * 0.005 - 0.0025)); // ±0.25%
      const totalPnl = ltp * (h.quantity ?? 0) - (h.avgPrice ?? 0) * (h.quantity ?? 0);
      const totalPnlPercent =
        (h.avgPrice ?? 0) * (h.quantity ?? 0) ? (totalPnl / ((h.avgPrice ?? 0) * (h.quantity ?? 0))) * 100 : 0;
      return { ...h, ltp, totalPnl, totalPnlPercent };
    });
    setHoldings(updated);
  };

  useEffect(() => {
    fetchHoldings();
    pollingRef.current = setInterval(fetchHoldings, POLL_INTERVAL);
    return () => clearInterval(pollingRef.current);
  }, []); // eslint-disable-line

  const totalColor = signColor(summary.totalReturn);
  const dayColor = signColor(summary.dayReturn);

  return (
    <div className="flex flex-col min-h-screen bg-[#0b1020] text-white overflow-hidden">

         <h2 className="text-lg md:text-xl font-semibold text-[26px] ml-3 mt-2 border-bottom-white">Portfolio</h2>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 mt-3">
        {/* Summary card */}
        <div className="bg-[#121a2b] p-5 rounded-xl shadow mb-6 border border-white/10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-400 text-sm">Invested</p>
              <p className="text-xl font-bold">{fmt(summary.invested)}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">Current Value</p>
              <p className="text-xl font-bold">{fmt(summary.current)}</p>
            </div>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-white/10">
            <p className="text-gray-400 text-sm">Overall P&L</p>
            <p className={`text-lg font-bold ${totalColor}`}>
              {signSym(summary.totalReturn)}
              {Number(summary.totalReturn).toFixed(2)} (
              {signSym(summary.totalReturnPercent)}
              {Number(summary.totalReturnPercent).toFixed(2)}%)
            </p>
          </div>

          <div className="flex justify-between items-center mt-2">
            <p className="text-gray-400 text-sm">Day P&L</p>
            <p className={`text-base font-semibold ${dayColor}`}>
              {signSym(summary.dayReturn)}
              {Number(summary.dayReturn).toFixed(2)} (
              {signSym(summary.dayReturnPercent)}
              {Number(summary.dayReturnPercent).toFixed(2)}%)
            </p>
          </div>
        </div>

        {/* Holdings list */}
        <h3 className="text-base font-semibold mb-3">Your Stocks ({holdings.length})</h3>
        <div>
          {pill === "All" ? (
            holdings.map((h) => <HoldingItem key={h.id} h={h} />)
          ) : (
            <div className="text-gray-400 bg-fuchsia-900/20 border border-fuchsia-700 rounded-lg p-3 text-sm">
              No pledged holdings found.
            </div>
          )}
        </div>

        {/* Note */}
        <div className="mt-6 p-3 text-xs bg-purple-900/30 text-purple-300 rounded-lg border border-purple-800">
          <p className="flex items-center">
            <Zap className="w-4 h-4 mr-2" />
            Real-time prices are simulated for demo. Updates every 10 seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
