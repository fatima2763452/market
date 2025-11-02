// OptionChainView.jsx (FINAL STABLE VERSION - Fixes White Screen)
import React, { useEffect, useState } from 'react';
import { TrendingDown, Loader, Zap } from 'lucide-react';

// --- DUMMY DATA FOR VISUALIZATION ---
const DUMMY_CHAIN_DATA = [
    // ... (Your existing DUMMY_CHAIN_DATA remains the same) ...
    { strike: 820, call: { oi: 0.10, ltp: 187.35, net_change_pct: 6.36, oi_chg: 11000, vol: 50000 }, put: { oi: 0.29, ltp: 0.10, net_change_pct: 4.00, oi_chg: 11000, vol: 20000 }, pcr: 2.89 },
    { strike: 840, call: { oi: 0.14, ltp: 121.00, net_change_pct: -7.14, oi_chg: -11000, vol: 80000 }, put: { oi: 0.54, ltp: 0.15, net_change_pct: 0.00, oi_chg: 0, vol: 15000 }, pcr: 3.77 },
    { strike: 850, call: { oi: 0.16, ltp: 146.80, net_change_pct: 7.14, oi_chg: 11000, vol: 95000 }, put: { oi: 2.78, ltp: 0.15, net_change_pct: -2.69, oi_chg: -7700, vol: 180000 }, pcr: 16.87 },
    { strike: 860, call: { oi: 0.01, ltp: 98.60, net_change_pct: -50.00, oi_chg: -1100, vol: 20000 }, put: { oi: 0.95, ltp: 0.15, net_change_pct: -5.49, oi_chg: -5500, vol: 10000 }, pcr: 86.00 },
    { strike: 880, call: { oi: 0.13, ltp: 105.00, net_change_pct: 0.00, oi_chg: 0, vol: 40000 }, put: { oi: 6.19, ltp: 0.25, net_change_pct: -2.09, oi_chg: -13200, vol: 220000 }, pcr: 46.92 },
    { strike: 900, call: { oi: 0.10, ltp: 80.00, net_change_pct: 0.00, oi_chg: 0, vol: 30000 }, put: { oi: 8.50, ltp: 0.35, net_change_pct: -5.00, oi_chg: -28600, vol: 300000 }, pcr: 85.00 },
];
// ---------------------------------------------


const OptionChainView = ({ selectedStock, sheetData }) => {
    
    const [chainData, setChainData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Mock data injection (runs once on load)
    useEffect(() => {
        const timer = setTimeout(() => {
            setChainData(DUMMY_CHAIN_DATA);
            setLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [selectedStock]); 

    if (loading) return <p className="p-8 text-center text-indigo-400"><Loader className="w-4 h-4 inline animate-spin mr-2"/> Loading...</p>;
    if (!chainData || chainData.length === 0) {
        return <div className="p-8 text-center text-red-400">No Option Chain data available.</div>;
    }

    const currentPrice = sheetData.ltp || 865.00; // Using 865.00 as mock spot price
    const expiry = "28 Oct"; // Mock expiry

    const getChangeClass = (value) => value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-500';
    const formatChange = (pct) => {
        if (pct === 0 || pct === '—') return '0.00%';
        const sign = pct > 0 ? '+' : '';
        return `${sign}${Number(pct).toFixed(2)}%`;
    };
    const formatValue = (value) => value !== undefined ? Number(value).toFixed(2) : '—';
    const formatOIData = (value) => value !== undefined ? (Number(value) / 100000).toFixed(2) : '—'; // Display in Lakhs

    // --- RENDER LOGIC ---
    return (
        <div className="w-full text-white overflow-hidden flex flex-col h-full"> {/* h-full for better vertical fit */}
            
            {/* Top Bar (Spot Price and Expiry) */}
            <div className="bg-[#1A1F30] p-2 flex justify-between items-center text-xs font-medium flex-shrink-0 shadow-md">
                <span className="text-gray-400">Expiry: <span className="text-white">{expiry}</span></span>
                <span className="text-yellow-400 flex items-center">
                    Spot Price: ₹{Number(currentPrice).toFixed(2)}
                </span>
            </div>

            {/* --- MAIN DUAL-SCROLL CONTAINER --- */}
            {/* Removed overflow-x-hidden to allow horizontal scroll on the wrapper */}
            <div className="flex flex-1 overflow-x-auto overflow-y-hidden"> 
                
                {/* 1. CALL SIDE (Left Scrollable Table) */}
                <div className="flex flex-col flex-1 max-w-[50%] min-w-0 pr-1 overflow-y-scroll"> {/* ADDED overflow-y-scroll here */}
                    <table className="min-w-[500px] divide-y divide-white/10 text-xs table-fixed">
                        <thead>
                            <tr className="bg-[#333846] sticky top-0 z-10 uppercase text-gray-400 font-normal">
                                <th className="w-[10%] py-2 text-right">OI (chg)</th>
                                <th className="w-[10%] py-2 text-right">OI (lakhs)</th>
                                <th className="w-[10%] py-2 text-right">Volume</th>
                                <th className="w-[10%] py-2 text-right">LTP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chainData.map((row, index) => {
                                const isITM = row.strike < currentPrice;
                                const rowClass = isITM ? 'bg-indigo-900/30 font-medium' : '';
                                
                                return (
                                    <tr key={row.strike} className={`hover:bg-[#21283D] ${rowClass}`}>
                                        <td className={`py-1 text-right ${getChangeClass(row.call?.oi_chg)}`}>{formatValue(row.call?.oi_chg) || '—'}</td>
                                        <td className="py-1 text-right text-gray-400">{formatOIData(row.call?.oi)}</td>
                                        <td className="py-1 text-right text-gray-400">{row.call?.vol?.toLocaleString() || '—'}</td>
                                        <td className="py-1 text-right text-yellow-400">{formatValue(row.call?.ltp)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* 2. STRIKE PRICE (FIXED CENTER COLUMN) */}
                {/* This column needs to vertically scroll with the other two panes */}
                <div className="w-[100px] flex flex-col justify-start items-center bg-[#2A314A] border-x border-white/20 flex-shrink-0 overflow-y-scroll">
                    <div className="h-[36px] flex items-center justify-center border-b border-white/20 sticky top-0 bg-[#2A314A]">
                        <span className="text-xs font-bold text-gray-400">Strike</span>
                    </div>
                    {chainData.map((row, index) => {
                        const isITM_Call = row.strike < currentPrice; 
                        const isITM_Put = row.strike > currentPrice; 
                        const bgColor = isITM_Call ? 'bg-indigo-800/40' : isITM_Put ? 'bg-gray-800/40' : '';
                        
                        return (
                            <div 
                                key={row.strike} 
                                className={`w-full py-1.5 text-center font-bold text-sm border-b border-white/10 ${bgColor} hover:bg-[#333846]`}
                            >
                                {row.strike}
                                <div className="text-[10px] font-normal text-gray-500">PCR: {row.pcr?.toFixed(2) || '--'}</div>
                            </div>
                        );
                    })}
                </div>

                {/* 3. PUT SIDE (Right Scrollable Table) */}
                <div className="flex flex-col flex-1 max-w-[50%] min-w-0 pl-1 overflow-y-scroll"> {/* ADDED overflow-y-scroll here */}
                     <table className="min-w-[500px] divide-y divide-white/10 text-xs table-fixed">
                        <thead>
                            <tr className="bg-[#333846] sticky top-0 z-10 uppercase text-gray-400 font-normal">
                                <th className="w-[10%] py-2 text-left">LTP</th>
                                <th className="w-[10%] py-2 text-left">Volume</th>
                                <th className="w-[10%] py-2 text-left">OI (lakhs)</th>
                                <th className="w-[10%] py-2 text-left">OI (chg)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chainData.map((row, index) => {
                                const isITM = row.strike > currentPrice;
                                const rowClass = isITM ? 'bg-indigo-900/30 font-medium' : '';
                                
                                return (
                                    <tr key={row.strike} className={`hover:bg-[#21283D] ${rowClass}`}>
                                        <td className="py-1 text-left text-yellow-400">{formatValue(row.put?.ltp)}</td>
                                        <td className="py-1 text-left text-gray-400">{row.put?.vol?.toLocaleString() || '—'}</td>
                                        <td className="py-1 text-left text-gray-400">{formatOIData(row.put?.oi)}</td>
                                        <td className={`py-1 text-left ${getChangeClass(row.put?.oi_chg)}`}>{formatValue(row.put?.oi_chg) || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

            </div>
            {/* End Main Dual-Scroll Container */}
            
            {/* Spot Price Footer */}
            <div className="bg-[#1A1F30] p-1.5 text-center text-xs font-semibold mt-auto flex-shrink-0">
                <span className="text-gray-400">Spot price: </span> 
                <span className="text-yellow-400">₹{Number(currentPrice).toFixed(2)}</span>
            </div>

        </div>
    );
}

export default OptionChainView;