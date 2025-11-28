// OptionChainFullscreen.jsx - Clean ATM-Centered Fullscreen Option Chain
import React, { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw, AlertCircle, Loader, TrendingDown, ChevronDown } from 'lucide-react';
import { useOptionChain } from '../../../hooks/useOptionChain';
import OptionStrikeBottomWindow from './OptionStrikeBottomWindow';

// Strike count options
const STRIKE_OPTIONS = [
    { label: '6 Strikes', value: 6 },
    { label: '12 Strikes', value: 12 },
    { label: '18 Strikes', value: 18 },
];

// Auto-refresh interval (in ms) - 5 seconds for near real-time feel
const AUTO_REFRESH_INTERVAL = 5000;

const OptionChainFullscreen = ({ selectedStock, sheetData, onClose }) => {
    const [selectedExpiry, setSelectedExpiry] = useState(null);
    const [strikeCount, setStrikeCount] = useState(12); // Default to 12 strikes
    const [lastUpdateTime, setLastUpdateTime] = useState(null);
    
    // State for selected strike bottom window
    const [selectedStrike, setSelectedStrike] = useState(null); // { strike, type: 'CE'|'PE', data }
    
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

    // Auto-refresh for near real-time data
    useEffect(() => {
        const interval = setInterval(() => {
            refetch();
            setLastUpdateTime(new Date());
        }, AUTO_REFRESH_INTERVAL);

        // Set initial update time
        setLastUpdateTime(new Date());

        return () => clearInterval(interval);
    }, [refetch]);

    // Update timestamp when data changes
    useEffect(() => {
        if (chainData) {
            setLastUpdateTime(new Date());
        }
    }, [chainData]);

    // Use live spot price from hook, fallback to sheetData
    const currentPrice = spotPrice || sheetData?.ltp || 0;

    // Find ATM strike and filter data around it
    const { filteredChain, atmStrike } = useMemo(() => {
        if (!chainData || chainData.length === 0 || !currentPrice) {
            return { filteredChain: [], atmStrike: null };
        }

        // Find ATM strike (closest to spot price)
        let closestStrike = chainData[0]?.strike;
        let minDiff = Math.abs(chainData[0]?.strike - currentPrice);
        
        chainData.forEach(row => {
            const diff = Math.abs(row.strike - currentPrice);
            if (diff < minDiff) {
                minDiff = diff;
                closestStrike = row.strike;
            }
        });

        // Find index of ATM strike
        const atmIndex = chainData.findIndex(row => row.strike === closestStrike);
        
        // Calculate strikes above and below based on selected count
        // strikeCount is total, so divide by 2 for each side
        const strikesPerSide = Math.floor((strikeCount - 1) / 2);
        let strikesAbove = strikesPerSide;
        let strikesBelow = strikesPerSide;
        
        // Adjust if we don't have enough strikes on one side
        const availableAbove = atmIndex;
        const availableBelow = chainData.length - atmIndex - 1;
        
        if (availableAbove < strikesAbove) {
            strikesAbove = availableAbove;
            strikesBelow = Math.min(availableBelow, strikeCount - strikesAbove - 1);
        }
        if (availableBelow < strikesBelow) {
            strikesBelow = availableBelow;
            strikesAbove = Math.min(availableAbove, strikeCount - strikesBelow - 1);
        }

        // Slice the data
        const startIndex = Math.max(0, atmIndex - strikesAbove);
        const endIndex = Math.min(chainData.length, atmIndex + strikesBelow + 1);
        
        return {
            filteredChain: chainData.slice(startIndex, endIndex),
            atmStrike: closestStrike
        };
    }, [chainData, currentPrice, strikeCount]);
    
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

    const formatLTP = (value) => {
        if (value === undefined || value === null) return '—';
        return Number(value).toFixed(2);
    };

    // Loading state
    if (loading) {
        return (
            <div className="fixed inset-0 bg-[#0A0F1E] z-[100] flex items-center justify-center">
                <div className="text-center">
                    <Loader className="w-10 h-10 inline animate-spin text-indigo-400 mb-4" />
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
                    <AlertCircle className="w-10 h-10 inline text-red-400 mb-4" />
                    <p className="text-red-400 mb-4">{error}</p>
                    <div className="flex gap-3 justify-center">
                        <button 
                            onClick={refetch}
                            className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" /> Retry
                        </button>
                        <button 
                            onClick={onClose}
                            className="px-5 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // No data state
    if (!filteredChain || filteredChain.length === 0) {
        return (
            <div className="fixed inset-0 bg-[#0A0F1E] z-[100] flex items-center justify-center">
                <div className="text-center max-w-md">
                    <TrendingDown className="w-10 h-10 inline mb-4 opacity-50 text-gray-400" />
                    <p className="text-gray-400 mb-2">No option chain data available</p>
                    <p className="text-gray-500 text-sm mb-4">This instrument may not support options trading</p>
                    <button 
                        onClick={onClose}
                        className="px-5 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-[#0A0F1E] z-[100] flex flex-col text-white">
            
            {/* Header Bar - Fixed - Mobile Optimized */}
            <div className="bg-[#141B2D] border-b border-white/10 px-3 py-2 flex-shrink-0">
                {/* Top Row: Title + Close */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <h1 className="text-base font-bold text-white truncate">
                            {selectedStock?.name || selectedStock?.tradingSymbol}
                        </h1>
                        <span className="flex items-center gap-1 flex-shrink-0">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] text-green-400">LIVE</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button 
                            onClick={() => { refetch(); setLastUpdateTime(new Date()); }}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4 text-gray-400" />
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition"
                            title="Close"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>
                </div>
                
                {/* Bottom Row: Spot + Filters */}
                <div className="flex items-center justify-between gap-2">
                    {/* Spot Price */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-gray-500 text-xs">Spot:</span>
                        <span className="text-yellow-400 text-sm font-bold">
                            ₹{Number(currentPrice).toFixed(2)}
                        </span>
                    </div>

                    {/* Filters Row */}
                    <div className="flex items-center gap-1.5">
                        {/* Strike Count */}
                        <select 
                            value={strikeCount}
                            onChange={(e) => setStrikeCount(Number(e.target.value))}
                            className="bg-[#1E2638] text-white px-2 py-1 rounded border border-white/10 focus:outline-none text-xs w-14"
                        >
                            {STRIKE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>

                        {/* Expiry */}
                        {expiries && expiries.length > 0 && (
                            <select 
                                value={selectedExpiry || expiries[0]} 
                                onChange={(e) => setSelectedExpiry(e.target.value)}
                                className="bg-[#1E2638] text-white px-2 py-1 rounded border border-white/10 focus:outline-none text-xs max-w-[90px]"
                            >
                                {expiries.map(exp => (
                                    <option key={exp} value={exp}>
                                        {formatExpiry(exp)}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content - Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-2xl mx-auto">
                    {/* Table Container */}
                    <div className="bg-[#141B2D] rounded-xl border border-white/10 shadow-2xl overflow-hidden">
                        
                        {/* Table Header - Separate from body */}
                        <div className="bg-[#1A2236] border-b border-white/10">
                            <div className="grid grid-cols-3">
                                <div className="py-3 px-6 text-center text-green-400 font-semibold text-sm uppercase tracking-wider">
                                    Call LTP
                                </div>
                                <div className="py-3 px-6 text-center text-gray-400 font-semibold text-sm uppercase tracking-wider border-x border-white/10">
                                    Strike
                                </div>
                                <div className="py-3 px-6 text-center text-red-400 font-semibold text-sm uppercase tracking-wider">
                                    Put LTP
                                </div>
                            </div>
                        </div>
                        
                        {/* Table Body */}
                        <div>
                            {filteredChain.map((row) => {
                                const isATM = row.strike === atmStrike;
                                
                                // Handler for clicking on Call LTP
                                const handleCallClick = () => {
                                    if (row.call?.ltp) {
                                        setSelectedStrike({
                                            strike: row.strike,
                                            type: 'CE',
                                            data: row.call,
                                            instrumentName: selectedStock?.name || selectedStock?.tradingSymbol,
                                            expiry: selectedExpiry || (expiries && expiries[0]),
                                        });
                                    }
                                };
                                
                                // Handler for clicking on Put LTP
                                const handlePutClick = () => {
                                    if (row.put?.ltp) {
                                        setSelectedStrike({
                                            strike: row.strike,
                                            type: 'PE',
                                            data: row.put,
                                            instrumentName: selectedStock?.name || selectedStock?.tradingSymbol,
                                            expiry: selectedExpiry || (expiries && expiries[0]),
                                        });
                                    }
                                };
                                
                                return (
                                    <div 
                                        key={row.strike} 
                                        className={`
                                            grid grid-cols-3 border-b border-white/5 transition-colors
                                            ${isATM 
                                                ? 'bg-yellow-500/10' 
                                                : 'hover:bg-white/5'
                                            }
                                        `}
                                    >
                                        {/* Call LTP - Clickable */}
                                        <div 
                                            className={`py-3 px-6 text-center cursor-pointer hover:bg-green-500/20 active:bg-green-500/30 transition-colors ${row.call?.ltp ? '' : 'opacity-50 cursor-not-allowed'}`}
                                            onClick={handleCallClick}
                                        >
                                            <span className={`font-mono text-base ${isATM ? 'text-green-300 font-bold' : 'text-green-400'}`}>
                                                {formatLTP(row.call?.ltp)}
                                            </span>
                                        </div>
                                        
                                        {/* Strike Price */}
                                        <div className={`
                                            py-3 px-6 text-center font-bold text-lg border-x border-white/10
                                            ${isATM 
                                                ? 'bg-yellow-500/20 text-yellow-300' 
                                                : 'bg-[#1E2430] text-white'
                                            }
                                        `}>
                                            {row.strike}
                                        </div>
                                        
                                        {/* Put LTP - Clickable */}
                                        <div 
                                            className={`py-3 px-6 text-center cursor-pointer hover:bg-red-500/20 active:bg-red-500/30 transition-colors ${row.put?.ltp ? '' : 'opacity-50 cursor-not-allowed'}`}
                                            onClick={handlePutClick}
                                        >
                                            <span className={`font-mono text-base ${isATM ? 'text-red-300 font-bold' : 'text-red-400'}`}>
                                                {formatLTP(row.put?.ltp)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="bg-[#1A2236] border-t border-white/10 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
                            <span>{filteredChain.length} strikes • ATM: {atmStrike}</span>
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                Updated: {lastUpdateTime?.toLocaleTimeString() || '—'}
                            </span>
                        </div>
                    </div>
                    
                    {/* Tap Hint */}
                    <p className="text-center text-gray-500 text-xs mt-4">
                        Tap on any LTP price to trade
                    </p>
                </div>
            </div>
            
            {/* Option Strike Bottom Window */}
            <OptionStrikeBottomWindow
                isOpen={selectedStrike !== null}
                onClose={() => setSelectedStrike(null)}
                optionType={selectedStrike?.type}
                strikePrice={selectedStrike?.strike}
                strikeData={selectedStrike?.data}
                underlyingStock={selectedStock}
                spotPrice={currentPrice}
                expiry={selectedStrike?.expiry}
            />
        </div>
    );
};

export default OptionChainFullscreen;
