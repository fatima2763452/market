// OptionStrikeBottomWindow.jsx - Bottom sheet for trading individual option strikes
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, ShoppingCart, DollarSign } from 'lucide-react';
import { logMarketStatus } from '../../../Utils/marketStatus.js'


const OptionStrikeBottomWindow = ({
    isOpen,
    onClose,
    optionType,          // 'CE' | 'PE'
    strikePrice,         // Number - e.g., 24250
    strikeData,          // Object - { ltp, bid, ask, oi, vol, iv, ... }
    underlyingStock,     // Object - parent stock info
    spotPrice,           // Number - underlying spot price
    expiry,              // String - expiry date
}) => {
    // Local states
    const [actionTab, setActionTab] = useState('Buy');
    const [productType, setProductType] = useState('Intraday');
    const [localLotsStr, setLocalLotsStr] = useState('1');
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const inputRef = useRef(null);

    const isMarketOpen = logMarketStatus();

    const userString = localStorage.getItem('loggedInUser');
    const userObject = userString ? JSON.parse(userString) : {};
    const userRole = userObject.role;


    // Extract values (moved before hooks that depend on them)
    const ltp = strikeData?.ltp || 0;
    const bestBid = strikeData?.bid || 0;
    const bestAsk = strikeData?.ask || 0;
    const lotSize = underlyingStock?.lot_size || underlyingStock?.lotSize || 50;

    // Reset state when strike changes
    useEffect(() => {
        if (isOpen) {
            setLocalLotsStr('1');
            setFeedback(null);
            setActionTab('Buy');
        }
    }, [isOpen, strikePrice, optionType]);

    // Calculations - ALL useMemo hooks must be called before any early return
    const lotsNum = useMemo(() => {
        const n = Number(localLotsStr);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }, [localLotsStr]);

    const qtyNum = useMemo(() => {
        return lotsNum * lotSize;
    }, [lotsNum, lotSize]);

    const requiredFunds = useMemo(() => {
        if (!ltp || !qtyNum) return 0;
        return ltp * qtyNum;
    }, [ltp, qtyNum]);

    // Don't render if not open - MUST be after ALL hooks
    if (!isOpen) return null;

    // Format instrument name
    const instrumentName = `${underlyingStock?.name || underlyingStock?.tradingSymbol || 'OPTION'} ${strikePrice} ${optionType}`;

    // Format expiry
    const formatExpiry = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Handlers
    const handleInputChange = (e) => {
        setLocalLotsStr(e.target.value);
        setFeedback(null);
    };

    const handleConfirm = async () => {
        if (!lotsNum || lotsNum < 1) {
            setFeedback({ type: 'error', message: 'Please enter a valid lot count.' });
            return;
        }

        // Parse activeContext
        const activeContextString = localStorage.getItem('activeContext');
        const activeContext = activeContextString ? JSON.parse(activeContextString) : null;
        const brokerId = activeContext?.brokerId || '';
        const customerId = activeContext?.customerId || '';

        const side = actionTab === 'Buy' ? 'BUY' : 'SELL';
        const product = productType === 'Intraday' ? 'MIS' : 'NRML';

        const payload = {
            broker_id_str: brokerId,
            customer_id_str: customerId,
            security_Id: strikeData?.securityId || '',
            symbol: `${underlyingStock?.tradingSymbol || ''}${strikePrice}${optionType}`,
            segment: underlyingStock?.segment || 'NSE_FNO',
            side,
            product,
            price: Number(ltp),
            quantity: qtyNum,
            lots: lotsNum,
            lot_size: lotSize,
            strike: strikePrice,
            optionType: optionType,
            expire: expiry || '',
            meta: { 
                from: 'ui_option_chain', 
                underlying: underlyingStock?.name,
                spotPrice: spotPrice
            }
        };

        console.log('Option Order payload:', payload);

        setSubmitting(true);
        setFeedback(null);

        const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

        try {
            const res = await fetch(`${apiBase}/api/orders/postOrder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            let body = null;
            try { body = await res.json(); } catch (e) { body = null; }

            if (!res.ok || (body && body.success === false)) {
                const message = body?.error || body?.message || `Server responded with ${res.status}`;
                throw new Error(message);
            }

            console.log('Option Order successful:', body);
            setFeedback({ type: 'success', message: 'Order placed successfully!' });

            setTimeout(() => {
                onClose();
            }, 1500);

        } catch (err) {
            console.error('Option Order failed:', err);
            setFeedback({ type: 'error', message: `Order failed: ${String(err.message || err)}` });
        } finally {
            setSubmitting(false);
        }
    };

    const getProductTypeClass = (mode) => {
        if (productType !== mode) return 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]';
        return actionTab === 'Buy' ? 'bg-green-600 text-white' : 'bg-red-600 text-white';
    };

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/60 z-[110]"
                onClick={onClose}
            />

            {/* Bottom Sheet */}
            <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg-card)] z-[120] rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
                
                {/* Header */}
                <div className="sticky top-0 bg-[var(--bg-card)] px-4 py-3 border-b border-[var(--border-color)]">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-[var(--text-primary)] font-bold text-lg">{instrumentName}</h2>
                            <p className="text-[var(--text-muted)] text-xs">{formatExpiry(expiry)}</p>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition"
                        >
                            <X className="w-5 h-5 text-[var(--text-secondary)]" />
                        </button>
                    </div>
                </div>

                {/* Price Bar */}
                <div className="px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
                    <div className="flex justify-between items-center">
                        <div className="text-center flex-1">
                            <p className="text-[var(--text-muted)] text-[10px] uppercase">Bid</p>
                            <p className="text-green-400 font-semibold text-sm">
                                {bestBid ? `₹${Number(bestBid).toFixed(2)}` : '—'}
                            </p>
                        </div>
                        <div className="text-center flex-1 border-x border-[var(--border-color)] px-4">
                            <p className="text-[var(--text-muted)] text-[10px] uppercase">LTP</p>
                            <p className="text-yellow-400 font-bold text-lg">
                                {ltp ? `₹${Number(ltp).toFixed(2)}` : '—'}
                            </p>
                        </div>
                        <div className="text-center flex-1">
                            <p className="text-[var(--text-muted)] text-[10px] uppercase">Ask</p>
                            <p className="text-red-400 font-semibold text-sm">
                                {bestAsk ? `₹${Number(bestAsk).toFixed(2)}` : '—'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-4 py-4 space-y-4">

                    {/* Buy/Sell Toggle */}
                    <div className="flex gap-2">
                        <button
                            className={`flex-1 py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-1 ${
                                actionTab === 'Buy' 
                                    ? 'bg-green-600 text-white' 
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                            }`}
                            onClick={() => setActionTab('Buy')}
                        >
                            <ShoppingCart className="w-4 h-4" /> BUY
                        </button>
                        <button
                            className={`flex-1 py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-1 ${
                                actionTab === 'Sell' 
                                    ? 'bg-red-600 text-white' 
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                            }`}
                            onClick={() => setActionTab('Sell')}
                        >
                            <DollarSign className="w-4 h-4" /> SELL
                        </button>
                    </div>

                    {/* Product Type */}
                    <div>
                        <p className="text-[var(--text-muted)] text-xs mb-2">Product Type</p>
                        <div className="flex gap-2">
                            <button 
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${getProductTypeClass('Intraday')}`}
                                onClick={() => setProductType('Intraday')}
                            >
                                Intraday
                            </button>
                            <button 
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${getProductTypeClass('Overnight')}`}
                                onClick={() => setProductType('Overnight')}
                            >
                                Overnight
                            </button>
                        </div>
                    </div>

                    {/* Quantity Input */}
                    <div>
                        <p className="text-[var(--text-muted)] text-xs mb-2">Quantity (Lots)</p>
                        <input
                            ref={inputRef}
                            type="number"
                            value={localLotsStr}
                            onChange={handleInputChange}
                            placeholder="Enter lots"
                            className="w-full p-3 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-[var(--border-color)]"
                            min="1"
                        />
                        <div className="flex justify-between mt-2 text-xs">
                            <span className="text-[var(--text-muted)]">
                                Lot size: <span className="text-[var(--text-primary)]">{lotSize}</span>
                            </span>
                            <span className="text-[var(--text-muted)]">
                                Qty: <span className="text-[var(--text-primary)]">{qtyNum} shares</span>
                            </span>
                        </div>
                    </div>

                    {/* Required Funds */}
                    <div className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-color)]">
                        <div className="flex justify-between items-center">
                            <span className="text-[var(--text-secondary)] text-sm">Required Funds</span>
                            <span className="text-[var(--text-primary)] font-bold text-lg">
                                {requiredFunds ? `₹${requiredFunds.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                            </span>
                        </div>
                    </div>

                    {/* Feedback */}
                    {feedback && (
                        <div className={`p-3 rounded-lg text-sm text-center ${
                            feedback.type === 'error' 
                                ? 'bg-red-500/20 text-red-400' 
                                : 'bg-green-500/20 text-green-400'
                        }`}>
                            {feedback.message}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2">

                        {(userRole === 'broker' || isMarketOpen ) && (<button
                            onClick={handleConfirm}
                            disabled={submitting || !lotsNum}
                            className={`w-full py-3.5 rounded-lg font-bold text-white text-base transition ${
                                actionTab === 'Buy' 
                                    ? 'bg-green-600 hover:bg-green-700' 
                                    : 'bg-red-600 hover:bg-red-700'
                            } ${(submitting || !lotsNum) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {submitting 
                                ? 'Placing Order...' 
                                : `INSTANT ${actionTab.toUpperCase()}`
                            }
                        </button>)}
                        <button
                            onClick={onClose}
                            className="w-full py-3 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-medium transition hover:bg-[var(--bg-hover)]"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>

            {/* Animation styles */}
            <style>{`
                @keyframes slide-up {
                    from {
                        transform: translateY(100%);
                    }
                    to {
                        transform: translateY(0);
                    }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
        </>
    );
};

export default OptionStrikeBottomWindow;
