// OptionChainView.jsx - Real API Integration with Live Updates
import React, { useState } from 'react';
import { TrendingDown, Loader, Zap, RefreshCw, AlertCircle } from 'lucide-react';
import { useOptionChain } from '../../../hooks/useOptionChain';

const OptionChainView = ({ selectedStock, sheetData }) => {
    const [selectedExpiry, setSelectedExpiry] = useState(null);
    
    // Fetch option chain data with live updates
    const { 
        chainData, 
        spotPrice, 
        expiries, 
        loading, 
        error,
        refetch 
    } = useOptionChain({
        segment: selectedStock?.segment,
        securityId: selectedStock?.securityId,
        expiry: selectedExpiry
    }); 

    // Loading state
    if (loading) {
        return (
            <div className="p-8 text-center">
                <Loader className="w-8 h-8 inline animate-spin text-indigo-400 mb-2" />
                <p className="text-gray-400 text-sm">Loading option chain...</p>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="p-8 text-center">
                <AlertCircle className="w-8 h-8 inline text-red-400 mb-2" />
                <p className="text-red-400 text-sm mb-3">{error}</p>
                <button 
                    onClick={refetch}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700 transition flex items-center gap-2 mx-auto"
                >
                    <RefreshCw className="w-4 h-4" /> Retry
                </button>
            </div>
        );
    }

    // No data state
    if (!chainData || chainData.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400">
                <TrendingDown className="w-8 h-8 inline mb-2 opacity-50" />
                <p className="text-sm">No option chain data available for this instrument.</p>
                <p className="text-xs mt-2">This may not be an options-enabled security.</p>
            </div>
        );
    }

    // Use live spot price from hook, fallback to sheetData
    const currentPrice = spotPrice || sheetData.ltp || 0;
    
    // Format expiry date if available
    const formatExpiry = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    };
    
    const displayExpiry = selectedExpiry || expiries[0] || 'N/A';

    const getChangeClass = (value) => value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-500';
    const formatChange = (pct) => {
        if (pct === 0 || pct === '—') return '0.00%';
        const sign = pct > 0 ? '+' : '';
        return `${sign}${Number(pct).toFixed(2)}%`;
    };
    const formatValue = (value) => value !== undefined && value !== null ? Number(value).toFixed(2) : '—';
    const formatOIData = (value) => value !== undefined && value !== null ? (Number(value) / 100000).toFixed(2) : '—'; // Display in Lakhs

    // --- RENDER LOGIC ---
    return (
        <div className="w-full text-white overflow-hidden flex flex-col h-full">
            
            {/* Top Bar (Spot Price, Expiry Selector, Refresh) */}
            <div className="bg-[#1A1F30] p-2 flex justify-between items-center text-xs font-medium flex-shrink-0 shadow-md gap-2">
                {/* Expiry Selector */}
                <div className="flex items-center gap-2">
                    <span className="text-gray-400">Expiry:</span>
                    {expiries.length > 0 ? (
                        <select 
                            value={selectedExpiry || expiries[0]} 
                            onChange={(e) => setSelectedExpiry(e.target.value)}
                            className="bg-[#2A314A] text-white px-2 py-1 rounded border border-white/20 text-xs focus:outline-none focus:border-indigo-500"
                        >
                            {expiries.map(exp => (
                                <option key={exp} value={exp}>
                                    {formatExpiry(exp)}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-white">{formatExpiry(displayExpiry)}</span>
                    )}
                </div>

                {/* Spot Price */}
                <div className="flex items-center gap-2">
                    <span className="text-yellow-400 flex items-center">
                        Spot: ₹{Number(currentPrice).toFixed(2)}
                    </span>
                    <button 
                        onClick={refetch}
                        className="p-1 hover:bg-white/10 rounded transition"
                        title="Refresh"
                    >
                        <RefreshCw className="w-3 h-3 text-gray-400 hover:text-white" />
                    </button>
                </div>
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
            
            {/* Spot Price Footer with Live Indicator */}
            <div className="bg-[#1A1F30] p-1.5 text-center text-xs font-semibold mt-auto flex-shrink-0 flex items-center justify-center gap-2">
                <span className="text-gray-400">Spot: </span> 
                <span className="text-yellow-400">₹{Number(currentPrice).toFixed(2)}</span>
                <span className="flex items-center gap-1 text-green-400">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    <span className="text-[10px]">LIVE</span>
                </span>
            </div>

        </div>
    );
}

export default OptionChainView;