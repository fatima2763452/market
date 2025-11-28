// OpenOrderBottomWindow.jsx
import React, { useState, useEffect } from 'react';
import { ShoppingCart, DollarSign, Hash, Zap, XCircle } from 'lucide-react';

const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;

// DetailRow Component
const DetailRow = ({ Icon, label, value, colorClass }) => {
    return (
        <div className="flex justify-between items-center py-0.5 px-2">
            <div className="flex items-center text-gray-400">
                {Icon && <Icon className="w-3 h-3 mr-2" />}
                <span className="text-xs">{label}</span>
            </div>
            <span className={`text-sm font-medium ${colorClass || "text-white"}`}>
                {value}
            </span>
        </div>
    );
};

export default function OpenOrderBottomWindow({ selectedOrder, onClose, sheetData }) {

    if (!selectedOrder) {
        return null;
    }

    const expireDate = selectedOrder.meta.selectedStock.expiry;
    const date = new Date(expireDate);
    const formattedStockExpireDate =
        String(date.getDate()).padStart(2, '0') + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        date.getFullYear();

    const {
        symbol, side, product, quantity: initialQty, price: initialPrice, jobbin_price,
        security_Id, segment, _id: orderId, lots,
    } = selectedOrder;

    // states
    const [newLot, setNewLot] = useState(String(lots ?? ''));
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null);
    // Order Status state ki ab zarurat kam hai kyunki hum button click par pass karenge, 
    // par initial rendering ke liye rakh sakte hain.
    const [orderStatus, setOrderStatus] = useState((selectedOrder.order_status || 'OPEN').toUpperCase());

    const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
    const token = localStorage.getItem("token") || null;

    const activeContextString = localStorage.getItem('activeContext');
    const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
    const brokerId = activeContext.brokerId;
    const customerId = activeContext.customerId;

    useEffect(() => {
        setNewLot(String(lots ?? ''));
        setFeedback(null);
        setOrderStatus((selectedOrder.order_status || 'OPEN').toUpperCase());
    }, [selectedOrder, lots]);

    const tradingsymbol = selectedOrder.meta?.selectedStock?.tradingSymbol ?? symbol ?? "N/A";
    const orderSide = String(side ?? "").toUpperCase();
    const productType = product === 'MIS' ? 'Intraday' : 'Overnight';
    const lotSize = selectedOrder.lot_size || selectedOrder.meta?.selectedStock?.lot_size || 1;

    const ltpRaw = sheetData?.ltp != null ? Number(sheetData.ltp) : null;
    const bestBidRaw = sheetData?.bestBidPrice != null ? Number(sheetData.bestBidPrice) : null;
    const bestAskRaw = sheetData?.bestAskPrice != null ? Number(sheetData.bestAskPrice) : null;

    const currentPrice = ltpRaw ?? bestAskRaw ?? bestBidRaw ?? 0;
    const formattedCMP = currentPrice ? `₹${currentPrice.toFixed(2)}` : '—';

    const avg = Number(initialPrice ?? 0);
    const ltp = Number(sheetData?.ltp ?? avg);
    const qty = Number(initialQty ?? 0);

    const diff = orderSide === "BUY" ? (ltp - avg) : (avg - ltp);
    const pnl = diff * qty;
    const profit = pnl >= 0;
    const pnlColor = profit ? "text-green-400" : "text-red-400";

    const isBuy = orderSide === 'BUY';

    // parsed inputs
    const parsedNewLot = Math.max(0, parseInt(String(newLot).trim() || '0', 10));
    const targetTotalQuantity = Number(parsedNewLot) * Number(lotSize || 1);

    // -------- AVG calculation --------
    let computedAvg = avg || 0;
    const currentExistingQty = Number(qty);
    const additionalQuantity = targetTotalQuantity - currentExistingQty;

    if (additionalQuantity > 0) {
        const totalExistingValue = currentExistingQty * avg;
        const totalNewValue = additionalQuantity * currentPrice;
        const totalValue = totalExistingValue + totalNewValue;
        computedAvg = targetTotalQuantity > 0 ? (totalValue / targetTotalQuantity) : 0;
    } else {
        computedAvg = avg;
    }

    const displayComputedAvg = `₹${Number(computedAvg || 0).toFixed(2)}`;
    const currentLots = Number(lots ?? 0);

    // *** UPDATED: handleAction ab arguments leta hai ***
    const handleAction = async (clickedAction, targetStatus) => {
        setSubmitting(true);
        setFeedback(null);

        try {
            // Validation Logic
            if (targetStatus === 'OPEN' && clickedAction === 'Adjust') {
                if (parsedNewLot < currentLots) {
                    setFeedback({
                        type: 'error',
                        message: `Invalid lots: you cannot set lots (${parsedNewLot}) less than current lots (${currentLots}).`
                    });
                    setSubmitting(false);
                    return;
                }
                if (parsedNewLot <= 0) {
                    setFeedback({ type: 'error', message: 'Lots must be greater than zero.' });
                    setSubmitting(false);
                    return;
                }
            }

            let endpoint, payload, method;

            if (clickedAction === 'Cancel') {
                endpoint = `${apiBase.replace(/\/$/, "")}/api/orders/cancelOrder`;
                method = 'POST';
                payload = {
                    broker_id_str: brokerId,
                    customer_id_str: customerId,
                    order_id: orderId,
                    security_Id: security_Id,
                    symbol: tradingsymbol,
                    segment,
                    meta: { from: 'ui_open_order_window' }
                };
            } else { // Adjust (Modify or Close)
                endpoint = `${apiBase.replace(/\/$/, "")}/api/orders/updateOrder`;
                method = 'POST';

                if (targetStatus === 'OPEN') {
                    // Adjust Logic
                    const lotValue = parsedNewLot;
                    payload = {
                        broker_id_str: brokerId,
                        customer_id_str: customerId,
                        order_id: orderId,
                        security_Id: security_Id,
                        symbol: tradingsymbol,
                        side: orderSide,
                        product: 'MIS',
                        lots: String(lotValue),
                        quantity: Number(targetTotalQuantity),
                        price: Number(Number(computedAvg).toFixed(2)),
                        came_From: 'Open',
                        order_status: 'OPEN', // Explicitly OPEN
                        meta: { from: 'ui_open_order_window' }
                    };
                } else {
                    // Close/Exit Logic (targetStatus === 'CLOSED' or 'HOLD')
                    const liveLtp = Number(sheetData?.ltp ?? 0);
                    const jobbing = Number(jobbin_price ?? 0);

                    let closedLtp = liveLtp;
                    if (liveLtp > 0 && !Number.isNaN(jobbing)) {
                        if (orderSide === 'BUY') {
                            closedLtp = liveLtp - (liveLtp * (jobbing / 100));
                        } else {
                            closedLtp = liveLtp + (liveLtp * (jobbing / 100));
                        }
                    }

                    payload = {
                        broker_id_str: brokerId,
                        customer_id_str: customerId,
                        order_id: orderId,
                        security_Id: security_Id,
                        closed_ltp: Number(Number(closedLtp || 0).toFixed(4)),
                        closed_at: new Date().toISOString(),
                        symbol: tradingsymbol,
                        order_status: targetStatus, // CLOSED
                        came_From: targetStatus === 'HOLD' ? 'Hold' : 'Open',
                        meta: { from: 'ui_open_order_window' }
                    };
                }
            }

            const res = await fetch(endpoint, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });

            let body = null;
            try { body = await res.json(); } catch (e) { body = null; }

            if (!res.ok) {
                const message = body?.message || body?.error || res.statusText || `Server responded with ${res.status}`;
                throw new Error(message);
            }

            if (body && body.success === false) {
                throw new Error(body.message || 'Server returned failure');
            }

            setFeedback({ type: 'success', message: body?.message || `${clickedAction} successful.` });
            try {
                const updatedOrder = body?.order || null;
                window.dispatchEvent(new CustomEvent('orders:changed', { detail: { order: updatedOrder } }));
            } catch (e) { /* ignore */ }
            onClose();

        } catch (err) {
            console.error("Error inside handleAction:", err);
            setFeedback({ type: 'error', message: `Failed to ${clickedAction}: ${String(err.message || err)}` });
        } finally {
            setSubmitting(false);
        }
    };

    const userString = localStorage.getItem('loggedInUser');
    const userObject = userString ? JSON.parse(userString) : {}; // Agar null hai to empty object
    const userRole = userObject.role;

    return (
        <div className="open-order-bottom-window fixed bottom-0 left-0 right-0 z-50 bg-[#121A2B] border-t border-white/10 shadow-2xl p-4 transition-transform duration-300">
            <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-2">
                <h3 className="text-xl text-white font-bold tracking-wide">
                    {tradingsymbol} ({orderSide})
                </h3>
                <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-white transition">
                    <XCircle className="w-6 h-6" />
                </button>
            </div>

            {feedback && (
                <div className={`p-2 mb-3 rounded-md text-sm ${feedback.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {feedback.message}
                </div>
            )}

            <div className="mb-4 flex justify-between items-end">
                <div>
                    <p className="text-xl font-bold">
                        <span className="text-gray-300 mr-1">₹</span>
                        <span className={pnlColor}>
                            {formattedCMP}
                        </span>
                    </p>
                    <p className="text-xs text-gray-500">Current Market Price (CMP)</p>
                </div>
                <div className="text-right">
                    <p className={`text-xl font-bold ${pnlColor}`}>{money(pnl)}</p>
                    <p className="text-xs text-gray-500">Total P&L</p>
                </div>
            </div>

            <div className="mb-2 p-2 bg-[#1A1F30] rounded-md text-xs">
                <DetailRow label="Quantity" value={`${initialQty} shares`} />
                <DetailRow label="Lots" value={`${lots} lots`} />
                <DetailRow label="Avg. Buy Price" value={money(initialPrice)} colorClass="text-yellow-300" />
                <DetailRow label="Type" value={orderSide} colorClass={isBuy ? "text-green-400" : "text-red-400"} />
                <DetailRow label="Order Instant" value={productType} colorClass="text-gray-300" />
                <DetailRow label="Expire Date" value={formattedStockExpireDate} colorClass="text-gray-300" />
            </div>

            {/* Dropdown removed from here */}

            <div className="p-3 bg-[#1F2028] rounded-lg mb-4">
                <h4 className="text-lg font-semibold mb-3 text-white">MODIFY ORDER</h4>

                <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                        {/* <Hash className="w-5 h-5 text-gray-400 mr-2" /> */}
                         <h6 className='text-lg font-semibold  text-white'>Lot</h6>
                        <input
                            type="number"
                            value={newLot}
                            onChange={(e) => setNewLot(e.target.value)}
                            placeholder="New Lots"
                            className="flex-1 p-2 bg-[#2A314A] text-white rounded-md transition"
                            disabled={orderStatus !== 'OPEN'} // Only allow lot change if Open
                        />
                        <div className="text-xs text-gray-400 italic">Lot size: <span className="font-medium text-white ml-1">{lotSize}</span></div>
                    </div>

                    {userRole === 'broker' && <div className="flex items-center">
                        <Hash className="w-5 h-5 text-gray-400 mr-2" />

                        <div className="w-75 p-2 bg-[#2A314A] text-white rounded-md transition flex items-center justify-between">
                            <span className="text-sm">Avg. Price</span>
                            <span className="font-medium">{displayComputedAvg}</span>
                        </div>
                    </div>}
                </div>
            </div>

            <div className="space-y-2">
                {/* Row 1: Adjust (50%) & Close (50%) */}
                <div className="flex space-x-2">
                    <button
                        onClick={() => handleAction('Adjust', 'OPEN')}
                        disabled={submitting}
                        className={`flex-1 p-3 rounded-lg text-white font-semibold transition bg-green-500 hover:bg-blue-700 ${submitting ? 'opacity-50' : ''}`}
                    >
                        BUY MORE
                    </button>
                    <button
                        onClick={() => handleAction('Adjust', 'CLOSED')}
                        disabled={submitting}
                        className={`flex-1 p-3 rounded-lg text-white font-semibold transition bg-red-500 hover:bg-yellow-700 ${submitting ? 'opacity-50' : ''}`}
                    >
                        EXIT
                    </button>
                </div>

                {/* Row 2: Hold Position (Full Width) - Replaces Cancel */}
                <button
                    // Action 'Adjust' rahega kyunki hum update kar rahe hain, bas status 'HOLD' bhejenge
                    onClick={() => handleAction('Adjust', 'HOLD')}
                    disabled={submitting}
                    className={`w-full p-3 rounded-lg text-white font-semibold transition bg-blue-500 hover:bg-purple-700 ${submitting ? 'opacity-50' : ''}`}
                >
                    CONVERT TO HOLD
                </button>
            </div>
        </div>
    );
}