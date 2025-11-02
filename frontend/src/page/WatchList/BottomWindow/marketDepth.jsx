// MarketDepthView.jsx (या MarketDepth.jsx)
import React from 'react';
import { Layers, Zap, TrendingUp, BarChart } from 'lucide-react';

// --- Price Row Helper Component ---
// Renders a single row of the order book
const DepthRow = ({ price, quantity, orders, type, maxQty }) => {
    const isBuy = type === 'buy';
    const priceColor = isBuy ? 'text-green-400' : 'text-red-400';
    const barWidth = (quantity / maxQty) * 100;

    return (
        <div className={`flex justify-between items-center text-sm py-0.5 relative transition`}>
            
            {/* Background Bar (Visualizing Depth/Volume) */}
            {/* The bar shows the volume relative to the max quantity seen */}
            <div 
                className={`absolute h-full ${isBuy ? 'bg-green-900/40 right-0' : 'bg-red-900/40 left-0'} transition-all duration-300`} 
                style={{ width: `${barWidth}%` }}
            ></div>

            {/* Content: Always on top of the bar */}
            <div className="relative z-10 flex w-full justify-between px-1 font-mono text-xs">
                
                {/* BUY SIDE (Orders | Quantity) - Aligned to Left */}
                {isBuy && (
                    <div className="flex w-full justify-between pr-4">
                        <span className="text-gray-400">{orders}</span> 
                        <span className="font-bold text-white">{quantity.toLocaleString()}</span>
                    </div>
                )}
                
                {/* PRICE (CENTER) */}
                <span className={`font-bold ${priceColor}`}>{Number(price).toFixed(2)}</span>
                
                {/* SELL SIDE (Quantity | Orders) - Aligned to Right */}
                {!isBuy && (
                    <div className="flex w-full justify-between pl-4">
                         <span className="font-bold text-white">{quantity.toLocaleString()}</span>
                         <span className="text-gray-400">{orders}</span>
                    </div>
                )}
            </div>
        </div>
    );
};


function MarketDepthView({ stockName, sheetData }) {
    // Assuming sheetData contains the raw depth object: sheetData.depth
    const depth = sheetData.depth;
    const ltp = sheetData.ltp;

    if (!depth || !depth.buy || !depth.sell || !ltp) {
        return (
            <div className="p-4 text-center text-gray-500 bg-[#1A1F30] rounded-lg">
                <Layers className="w-6 h-6 mx-auto mb-2" />
                <p>Market Depth Data Not Available / Market Closed.</p>
            </div>
        );
    }
    
    // Sort and process data
    const buyDepth = [...depth.buy].sort((a, b) => b.price - a.price); // Best price first
    const sellDepth = [...depth.sell].sort((a, b) => a.price - b.price); // Best price first

    // Calculate maximum quantity for scaling the bar widths
    const allQuantities = [...buyDepth.map(i => i.quantity), ...sellDepth.map(i => i.quantity)];
    const maxQty = Math.max(...allQuantities);
    
    // Calculate totals
    const totalBuyQty = depth.buy.reduce((sum, item) => sum + item.quantity, 0);
    const totalSellQty = depth.sell.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="w-full bg-[#1F2028] rounded-lg shadow-xl text-white">
            
            {/* Header / Titles */}
            <div className="flex justify-between text-xs text-gray-400 font-medium pt-3 px-3">
                <span className="w-1/2 text-left">Buy Orders | Qty</span>
                <span className="w-1/4 text-center">Price</span>
                <span className="w-1/4 text-right">Qty | Sell Orders</span>
            </div>

            {/* --- SELL SIDE (Top of the Book - Ascending Price) --- */}
            <div className="max-h-40 overflow-y-auto mt-1 border-b border-white/10">
                {sellDepth.map((item, index) => (
                    <DepthRow key={`s-${index}`} {...item} type="sell" maxQty={maxQty} />
                ))}
            </div>

            {/* --- LTP / Spread Line --- */}
            <div className="flex justify-center items-center text-md font-bold py-1 bg-[#333846] rounded-sm my-1">
                <span className="text-yellow-400 mr-2">LTP: {Number(ltp).toFixed(2)}</span>
            </div>

            {/* --- BUY SIDE (Bottom of the Book - Descending Price) --- */}
            <div className="max-h-40 overflow-y-auto border-t border-white/10">
                 {/* Reversing the order to display best bids at the top of this section */}
                {buyDepth.map((item, index) => (
                    <DepthRow key={`b-${index}`} {...item} type="buy" maxQty={maxQty} />
                ))}
            </div>
            
            {/* --- Total Quantity Summary --- */}
            <div className="p-3 border-t border-white/10 mt-2 text-sm font-semibold bg-[#2A314A]">
                <div className="flex justify-between text-gray-400 mb-1">
                    <span>Total Buy Qty:</span>
                    <span className="text-green-400">{totalBuyQty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                    <span>Total Sell Qty:</span>
                    <span className="text-red-400">{totalSellQty.toLocaleString()}</span>
                </div>
            </div>

        </div>
    );
}

export default MarketDepthView;