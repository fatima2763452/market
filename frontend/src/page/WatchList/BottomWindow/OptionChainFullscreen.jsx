// OptionChainFullscreen.jsx - Fullscreen Option Chain with Professional UI
import React, { useState, useEffect } from 'react';
import { X, RefreshCw, AlertCircle, Loader, TrendingUp, TrendingDown } from 'lucide-react';
import { useOptionChain } from '../../../hooks/useOptionChain';

const OptionChainFullscreen = ({ selectedStock, sheetData, onClose }) => {
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

    // Handle ESC key to close
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    // Use live spot price from hook, fallback to sheetData
    const currentPrice = spotPrice || sheetData?.ltp || 0;
    
    // Format expiry date
    const formatExpiry = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            day: 'numeric', 
            month: 'short',
            year: 'numeric'
        });
    };

    const getChangeClass = (value) => {
        if (!value || value === 0) return 'text-gray-500';
        return value > 0 ? 'text-green-400' : 'text-red-400';
    };

    const formatValue = (value) => {
        if (value === undefined || value === null) return '—';
        return Number(value).toFixed(2);
    };

    const formatOI = (value) => {
        if (!value) return '—';
        const lakhs = Number(value) / 100000;
        return lakhs.toFixed(2);
    };

    const formatVolume = (value) => {
        if (!value) return '—';
        const num = Number(value);
        if (num >= 100000) return (num / 100000).toFixed(1) + 'L';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    };

    // Loading state
    if (loading) {
        return (
            <div className="fixed inset-0 bg-[#0A0F1E] z-[100] flex items-center justify-center">
                <div className="text-center">
                    <Loader className="w-12 h-12 inline animate-spin text-indigo-400 mb-4" />
                    <p className="text-gray-400">Loading option chain...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="fixed inset-0 bg-[#0A0F1E] z-[100] flex items-center justify-center">
                <div className="text-center max-w-md">
                    <AlertCircle className="w-12 h-12 inline text-red-400 mb-4" />
                    <p className="text-red-400 mb-4">{error}</p>
                    <div className="flex gap-3 justify-center">
                        <button 
                            onClick={refetch}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" /> Retry
                        </button>
                        <button 
                            onClick={onClose}
                            className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // No data state
    if (!chainData || chainData.length === 0) {
        return (
            <div className="fixed inset-0 bg-[#0A0F1E] z-[100] flex items-center justify-center">
                <div className="text-center max-w-md">
                    <TrendingDown className="w-12 h-12 inline mb-4 opacity-50 text-gray-400" />
                    <p className="text-gray-400 mb-2">No option chain data available</p>
                    <p className="text-gray-500 text-sm mb-4">This instrument may not support options trading</p>
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-[#0A0F1E] z-[100] flex flex-col text-white">
            
            {/* Header Bar */}
            <div className="bg-[#141B2D] border-b border-white/10 px-3 md:px-6 py-3 md:py-4 flex items-center justify-between shadow-lg flex-wrap gap-2">
                <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                    <div>
                        <h1 className="text-lg md:text-2xl font-bold text-white">
                            {selectedStock?.name || selectedStock?.tradingSymbol}
                        </h1>
                        <p className="text-xs md:text-sm text-gray-400">Option Chain</p>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                        <span className="text-gray-400 text-xs md:text-sm">Spot:</span>
                        <span className="text-yellow-400 text-base md:text-xl font-bold">
                            ₹{Number(currentPrice).toFixed(2)}
                        </span>
                        <span className="flex items-center gap-1 text-green-400">
                            <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-400 rounded-full animate-pulse"></span>
                            <span className="text-[10px] md:text-xs">LIVE</span>
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    {/* Expiry Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs md:text-sm hidden md:inline">Expiry:</span>
                        {expiries && expiries.length > 0 ? (
                            <select 
                                value={selectedExpiry || expiries[0]} 
                                onChange={(e) => setSelectedExpiry(e.target.value)}
                                className="bg-[#1E2638] text-white px-2 md:px-4 py-1 md:py-2 rounded-lg border border-white/20 focus:outline-none focus:border-indigo-500 cursor-pointer text-xs md:text-sm"
                            >
                                {expiries.map(exp => (
                                    <option key={exp} value={exp}>
                                        {formatExpiry(exp)}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <span className="text-white px-2 md:px-4 py-1 md:py-2 text-xs md:text-sm">{formatExpiry(selectedExpiry)}</span>
                        )}
                    </div>

                    {/* Refresh Button */}
                    <button 
                        onClick={refetch}
                        className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg transition"
                        title="Refresh data"
                    >
                        <RefreshCw className="w-4 h-4 md:w-5 md:h-5 text-gray-400 hover:text-white" />
                    </button>

                    {/* Close Button */}
                    <button 
                        onClick={onClose}
                        className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg transition"
                        title="Close (ESC)"
                    >
                        <X className="w-5 h-5 md:w-6 md:h-6 text-gray-400 hover:text-white" />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden p-2 md:p-6">
                <div className="h-full bg-[#141B2D] rounded-lg border border-white/10 overflow-hidden flex flex-col">
                    
                    {/* Single Scrollable Container for Header + Body */}
                    <div className="flex-1 overflow-x-auto overflow-y-auto">
                        <div className="min-w-[732px]"> {/* Minimum width to ensure proper layout */}
                            
                            {/* Table Header - Scrolls with body */}
                            <div className="bg-[#1A2236] border-b border-white/10 sticky top-0 z-10">
                                <div className="grid grid-cols-[minmax(350px,1fr)_auto_minmax(350px,1fr)] md:grid-cols-[1fr_auto_1fr] items-center">
                                    
                                    {/* CALL Headers */}
                                    <div className="grid grid-cols-10 text-center text-[9px] md:text-[11px] font-semibold text-gray-400 uppercase py-2 md:py-3 px-1 md:px-2 border-r border-white/10">
                                        <div className="col-span-1 px-0.5">OI</div>
                                        <div className="col-span-1 px-0.5">Chng OI</div>
                                        <div className="col-span-1 px-0.5">Vol</div>
                                        <div className="col-span-1 px-0.5">IV</div>
                                        <div className="col-span-1 px-0.5">LTP</div>
                                        <div className="col-span-1 px-0.5">Chng</div>
                                        <div className="col-span-1 px-0.5">Bid Q</div>
                                        <div className="col-span-1 px-0.5">Bid</div>
                                        <div className="col-span-1 px-0.5">Ask</div>
                                        <div className="col-span-1 px-0.5">Ask Q</div>
                                    </div>

                                    {/* Strike Header */}
                                    <div className="w-16 md:w-28 text-center py-2 md:py-3 px-1 md:px-2 bg-[#2A314A]">
                                        <div className="text-[10px] md:text-xs font-bold text-gray-300 uppercase">Strike</div>
                                    </div>

                                    {/* PUT Headers */}
                                    <div className="grid grid-cols-10 text-center text-[9px] md:text-[11px] font-semibold text-gray-400 uppercase py-2 md:py-3 px-1 md:px-2 border-l border-white/10">
                                        <div className="col-span-1 px-0.5">Bid Q</div>
                                        <div className="col-span-1 px-0.5">Bid</div>
                                        <div className="col-span-1 px-0.5">Ask</div>
                                        <div className="col-span-1 px-0.5">Ask Q</div>
                                        <div className="col-span-1 px-0.5">Chng</div>
                                        <div className="col-span-1 px-0.5">LTP</div>
                                        <div className="col-span-1 px-0.5">IV</div>
                                        <div className="col-span-1 px-0.5">Vol</div>
                                        <div className="col-span-1 px-0.5">Chng OI</div>
                                        <div className="col-span-1 px-0.5">OI</div>
                                    </div>
                                </div>
                            </div>

                            {/* Table Body Rows */}
                            <div>
                                {chainData.map((row, index) => {
                                    const isCallITM = row.strike < currentPrice;
                                    const isPutITM = row.strike > currentPrice;
                                    const isATM = Math.abs(row.strike - currentPrice) < (currentPrice * 0.005); // Within 0.5%

                                    return (
                                        <div 
                                            key={row.strike} 
                                            className={`grid grid-cols-[minmax(350px,1fr)_auto_minmax(350px,1fr)] md:grid-cols-[1fr_auto_1fr] items-center hover:bg-[#1E2638] transition border-b border-white/5 ${
                                                isATM ? 'bg-yellow-500/5 border-yellow-500/20' : ''
                                            }`}
                                        >
                                            {/* CALL Side */}
                                            <div className={`grid grid-cols-10 text-center text-[10px] md:text-sm py-1.5 md:py-2.5 px-1 md:px-2 border-r border-white/10 ${
                                                isCallITM ? 'bg-green-500/10' : ''
                                            }`}>
                                                <div className="text-gray-300 truncate px-0.5">{formatOI(row.call?.oi)}</div>
                                                <div className={`${getChangeClass(row.call?.oi_chg)} truncate px-0.5`}>{formatValue(row.call?.oi_chg)}</div>
                                                <div className="text-gray-400 truncate px-0.5">{formatVolume(row.call?.vol)}</div>
                                                <div className="text-gray-400 truncate px-0.5">{formatValue(row.call?.iv)}</div>
                                                <div className="text-white font-semibold truncate px-0.5">{formatValue(row.call?.ltp)}</div>
                                                <div className={`${getChangeClass(row.call?.change)} truncate px-0.5`}>{formatValue(row.call?.change)}</div>
                                                <div className="text-gray-400 truncate px-0.5">{row.call?.bidQty || '—'}</div>
                                                <div className="text-blue-400 font-medium truncate px-0.5">{formatValue(row.call?.bid)}</div>
                                                <div className="text-red-400 font-medium truncate px-0.5">{formatValue(row.call?.ask)}</div>
                                                <div className="text-gray-400 truncate px-0.5">{row.call?.askQty || '—'}</div>
                                            </div>

                                            {/* Strike Price */}
                                            <div className={`w-16 md:w-28 text-center py-1.5 md:py-2.5 px-1 md:px-2 text-xs md:text-base ${
                                                isATM 
                                                    ? 'bg-yellow-500/20 text-yellow-300 font-bold' 
                                                    : 'bg-[#1E2638] text-white font-semibold'
                                            }`}>
                                                {row.strike}
                                            </div>

                                            {/* PUT Side */}
                                            <div className={`grid grid-cols-10 text-center text-[10px] md:text-sm py-1.5 md:py-2.5 px-1 md:px-2 border-l border-white/10 ${
                                                isPutITM ? 'bg-red-500/10' : ''
                                            }`}>
                                                <div className="text-gray-400 truncate px-0.5">{row.put?.bidQty || '—'}</div>
                                                <div className="text-blue-400 font-medium truncate px-0.5">{formatValue(row.put?.bid)}</div>
                                                <div className="text-red-400 font-medium truncate px-0.5">{formatValue(row.put?.ask)}</div>
                                                <div className="text-gray-400 truncate px-0.5">{row.put?.askQty || '—'}</div>
                                                <div className={`${getChangeClass(row.put?.change)} truncate px-0.5`}>{formatValue(row.put?.change)}</div>
                                                <div className="text-white font-semibold truncate px-0.5">{formatValue(row.put?.ltp)}</div>
                                                <div className="text-gray-400 truncate px-0.5">{formatValue(row.put?.iv)}</div>
                                                <div className="text-gray-400 truncate px-0.5">{formatVolume(row.put?.vol)}</div>
                                                <div className={`${getChangeClass(row.put?.oi_chg)} truncate px-0.5`}>{formatValue(row.put?.oi_chg)}</div>
                                                <div className="text-gray-300 truncate px-0.5">{formatOI(row.put?.oi)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Footer with Legend */}
                    <div className="bg-[#1A2236] border-t border-white/10 px-3 md:px-6 py-2 md:py-3 flex items-center justify-between text-[10px] md:text-xs flex-wrap gap-2">
                        <div className="flex items-center gap-3 md:gap-6 flex-wrap">
                            <div className="flex items-center gap-1 md:gap-2">
                                <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500/20 border border-green-500/50"></div>
                                <span className="text-gray-400">Call ITM</span>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2">
                                <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500/20 border border-red-500/50"></div>
                                <span className="text-gray-400">Put ITM</span>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2">
                                <div className="w-2 h-2 md:w-3 md:h-3 bg-yellow-500/20 border border-yellow-500/50"></div>
                                <span className="text-gray-400">ATM</span>
                            </div>
                        </div>
                        <div className="text-gray-500">
                            {chainData.length} strikes
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OptionChainFullscreen;
