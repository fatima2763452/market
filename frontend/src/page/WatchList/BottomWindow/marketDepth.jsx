// Market Depth View - 5 Level Order Book
import React from 'react';
import { Layers } from 'lucide-react';

// Single row component for order book
const DepthRow = ({ price, quantity, orders, type, maxQty }) => {
    const isBuy = type === 'buy';
    const barWidth = maxQty > 0 ? (quantity / maxQty) * 100 : 0;

    return (
        <div className="relative flex items-center text-xs py-1 hover:bg-white/5 transition-colors">
            {/* Background bar showing volume */}
            <div 
                className={`absolute h-full ${isBuy ? 'bg-green-500/20 right-0' : 'bg-red-500/20 left-0'}`} 
                style={{ width: `${barWidth}%` }}
            />
            
            {/* Content */}
            <div className="relative z-10 flex w-full items-center px-2 font-mono">
                {/* BUY SIDE - Left aligned */}
                {isBuy ? (
                    <>
                        <span className="w-1/4 text-gray-400">{orders}</span>
                        <span className="w-1/4 text-right text-white font-medium">{quantity.toLocaleString()}</span>
                        <span className="w-1/2 text-right text-green-400 font-semibold">{Number(price).toFixed(2)}</span>
                    </>
                ) : (
                    <>
                        <span className="w-1/2 text-left text-red-400 font-semibold">{Number(price).toFixed(2)}</span>
                        <span className="w-1/4 text-left text-white font-medium">{quantity.toLocaleString()}</span>
                        <span className="w-1/4 text-right text-gray-400">{orders}</span>
                    </>
                )}
            </div>
        </div>
    );
};


function MarketDepthView({ stockName, sheetData }) {
    const depth = sheetData?.depth;
    const ltp = sheetData?.ltp;
    const bestBidPrice = sheetData?.bestBidPrice;
    const bestAskPrice = sheetData?.bestAskPrice;

    if (!depth || !depth.buy || !depth.sell) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500 bg-[#1A1F30] rounded-lg">
                <Layers className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Market Depth Not Available</p>
                <p className="text-xs text-gray-600 mt-1">Subscribe to full data mode</p>
            </div>
        );
    }
    
    // Sort depth data - take only 5 levels
    const buyDepth = [...depth.buy]
        .sort((a, b) => b.price - a.price)
        .slice(0, 5);
    const sellDepth = [...depth.sell]
        .sort((a, b) => a.price - b.price)
        .slice(0, 5)
        .reverse(); // Reverse to show highest sell at bottom

    // Calculate max quantity for bar width scaling
    const allQuantities = [
        ...buyDepth.map(i => i.quantity), 
        ...sellDepth.map(i => i.quantity)
    ];
    const maxQty = Math.max(...allQuantities, 1);
    
    // Calculate totals
    const totalBuyQty = buyDepth.reduce((sum, item) => sum + item.quantity, 0);
    const totalSellQty = sellDepth.reduce((sum, item) => sum + item.quantity, 0);
    
    // Calculate spread
    const spread = bestAskPrice && bestBidPrice ? (bestAskPrice - bestBidPrice).toFixed(2) : '--';

    return (
        <div className="w-full h-full bg-[#0F1419] text-white overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#1A1F2E] border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-semibold">Market Depth</span>
                    <span className="text-xs text-gray-500">({stockName || 'N/A'})</span>
                </div>
                <div className="text-xs text-gray-400">
                    5 Levels
                </div>
            </div>

            {/* Column Headers */}
            <div className="flex items-center px-2 py-1.5 bg-[#1A1F2E] border-b border-gray-800 text-[10px] font-medium text-gray-500">
                <span className="w-1/4">Orders</span>
                <span className="w-1/4 text-right">Qty</span>
                <span className="w-1/2 text-right">Bid</span>
            </div>

            {/* BUY SIDE (5 levels) */}
            <div className="border-b border-gray-800">
                {buyDepth.length > 0 ? (
                    buyDepth.map((item, index) => (
                        <DepthRow key={`b-${index}`} {...item} type="buy" maxQty={maxQty} />
                    ))
                ) : (
                    <div className="py-8 text-center text-gray-600 text-xs">No buy orders</div>
                )}
            </div>

            {/* LTP / SPREAD Section */}
            <div className="flex items-center justify-between px-2 py-2 bg-[#1A1F2E] border-y border-gray-700">
                <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500">LTP</span>
                    <span className="text-sm font-bold text-yellow-400">{ltp ? Number(ltp).toFixed(2) : '--'}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-gray-500">Spread</span>
                    <span className="text-sm font-semibold text-gray-300">{spread}</span>
                </div>
            </div>

            {/* Column Headers for SELL */}
            <div className="flex items-center px-2 py-1.5 bg-[#1A1F2E] border-b border-gray-800 text-[10px] font-medium text-gray-500">
                <span className="w-1/2">Ask</span>
                <span className="w-1/4 text-left">Qty</span>
                <span className="w-1/4 text-right">Orders</span>
            </div>

            {/* SELL SIDE (5 levels) */}
            <div className="border-b border-gray-800">
                {sellDepth.length > 0 ? (
                    sellDepth.map((item, index) => (
                        <DepthRow key={`s-${index}`} {...item} type="sell" maxQty={maxQty} />
                    ))
                ) : (
                    <div className="py-8 text-center text-gray-600 text-xs">No sell orders</div>
                )}
            </div>
            
            {/* Footer Summary */}
            <div className="px-3 py-2 bg-[#1A1F2E] border-t border-gray-700">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Total Bid Qty:</span>
                    <span className="text-green-400 font-semibold">{totalBuyQty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Total Ask Qty:</span>
                    <span className="text-red-400 font-semibold">{totalSellQty.toLocaleString()}</span>
                </div>
            </div>

        </div>
    );
}

export default MarketDepthView;