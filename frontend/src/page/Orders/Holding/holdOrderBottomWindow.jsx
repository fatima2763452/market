// HoldOrderBottomWindow.jsx
import React, { useState, useEffect } from 'react';
import { ShoppingCart, DollarSign, Hash, Zap, XCircle, Clock } from 'lucide-react';

const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;

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

export default function HoldOrderBottomWindow({ selectedOrder, onClose, sheetData }) {

    if (!selectedOrder) {
        return null;
    }

    // expiry display
    const expireDate = selectedOrder.meta?.selectedStock?.expiry;
    const formattedStockExpireDate = expireDate ?
        new Date(expireDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'N/A';

    const {
        symbol, side, product, quantity: initialQty, price: initialPrice, jobbin_price,
        security_Id, segment, _id: orderId, lots, lot_size,
    } = selectedOrder;

    // states
    const [newLot, setNewLot] = useState(String(lots ?? ''));
    const [submitting, setSubmitting] = useState(false);
    const [action, setAction] = useState('Adjust');
    const [feedback, setFeedback] = useState(null);

    const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
    const token = localStorage.getItem("token") || null;

    const activeContextString = localStorage.getItem('activeContext');
    const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
    const brokerId = activeContext.brokerId;
    const customerId = activeContext.customerId;

    useEffect(() => {
        setNewLot(String(lots ?? ''));
        setFeedback(null);
        setAction('Adjust');
    }, [selectedOrder, lots]);

    const tradingsymbol = selectedOrder.meta?.selectedStock?.tradingSymbol ?? symbol ?? "N/A";
    const orderSide = String(side ?? "").toUpperCase();
    const currentLotSize = lot_size || selectedOrder.meta?.selectedStock?.lot_size || 1;

    const ltpRaw = sheetData?.ltp != null ? Number(sheetData.ltp) : null;
    const bestBidRaw = sheetData?.bestBidPrice != null ? Number(sheetData.bestBidPrice) : null;
    const bestAskRaw = sheetData?.bestAskPrice != null ? Number(sheetData.bestAskPrice) : null;

    const currentPrice = ltpRaw ?? bestAskRaw ?? bestBidRaw ?? 0;
    const formattedCMP = currentPrice ? `₹${currentPrice.toFixed(2)}` : '—';

    const avg = Number(initialPrice ?? 0);
    const ltp = Number(sheetData?.ltp ?? avg);
    const qty = Number(initialQty ?? 0);

    const diff = orderSide === "BUY" ? (ltp - avg) : (avg - ltp);
    const pnl = currentPrice ? (diff * qty) : 0;
    const profit = pnl >= 0;
    const pnlColor = profit ? "text-green-400" : "text-red-400";

    const isBuy = orderSide === 'BUY';
    const adjustActionColor = isBuy ? 'bg-green-600' : 'bg-green-600';
    const closeActionColor = 'bg-red-500 hover:bg-red-700';

    // parsed inputs
    const parsedNewLot = Math.max(0, parseInt(String(newLot).trim() || '0', 10));
    const computedQuantity = Number(parsedNewLot) * Number(currentLotSize || 1);

    // computed avg (weighted) — same logic as OpenOrderBottomWindow
    let computedAvg = avg || 0;
    if (computedQuantity > 0) {
        const totalExisting = avg * qty;
        const totalNew = currentPrice * computedQuantity;
        const combinedQty = qty + computedQuantity;
        computedAvg = combinedQty > 0 ? (totalExisting + totalNew) / combinedQty : (currentPrice || avg || 0);
    } else {
        computedAvg = avg || currentPrice || 0;
    }
    const displayComputedAvg = `₹${Number(computedAvg || 0).toFixed(2)}`;

    // convenience
    const currentLots = Number(lots ?? 0);

    // handleAction: 'Adjust' or 'Close'
    const handleAction = async (intendedAction) => {
        setSubmitting(true);
        setFeedback(null);
        setAction(intendedAction);

        try {
            // validation: new lots cannot be less than current DB lots
            if (intendedAction === 'Adjust') {
                if (parsedNewLot < currentLots) {
                    setFeedback({
                        type: 'error',
                        message: `Invalid lots: cannot set lots (${parsedNewLot}) less than current lots (${currentLots}).`
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

            const endpoint = `${apiBase.replace(/\/$/, "")}/api/orders/updateOrder`;
            let payload = {};
            const basePayload = {
                broker_id_str: brokerId,
                customer_id_str: customerId,
                order_id: orderId,
                security_Id: security_Id,
                symbol: tradingsymbol,
                side: orderSide,
                product: product,
                segment: segment,
            };

            if (intendedAction === 'Adjust') {
                // send computedAvg as price (2dp), computedQuantity as quantity, keep it HOLD
                payload = {
                    ...basePayload,
                    lots: String(parsedNewLot),
                    quantity: Number(computedQuantity),
                    price: Number(Number(computedAvg).toFixed(2)),
                    order_status: "HOLD",
                    meta: { from: 'ui_holding_order_adjustment' }
                };

            } else if (intendedAction === 'Close') {
                // compute closed_ltp using jobbing formula (jobbin_price expected like 0.08 meaning 0.08%)
                const liveLtp = Number(sheetData?.ltp ?? 0);
                const jobbingRaw = Number(selectedOrder.jobbin_price ?? jobbin_price ?? 0);
                const jobbingPct = Number.isFinite(jobbingRaw) ? (jobbingRaw / 100) : 0;

                let closedLtp = liveLtp || currentPrice || initialPrice || 0;
                if (closedLtp > 0 && !Number.isNaN(jobbingPct) && jobbingPct !== 0) {
                    if (orderSide === 'BUY') {
                        closedLtp = closedLtp - (closedLtp * jobbingPct);
                    } else {
                        closedLtp = closedLtp + (closedLtp * jobbingPct);
                    }
                }

                payload = {
                    ...basePayload,
                    lots: String(lots),
                    quantity: Number(initialQty),
                    closed_ltp: Number(Number(closedLtp || 0).toFixed(4)),
                    closed_at: new Date().toISOString(),
                    order_status: "CLOSED",
                    came_From: 'Hold',
                    meta: { from: 'ui_holding_order_closure' }
                };
            } else {
                throw new Error("Invalid action specified.");
            }

            const res = await fetch(endpoint, {
                method: 'POST',
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

            setFeedback({ type: 'success', message: body?.message || `${intendedAction} successful.` });

            try {
                const updatedOrder = body?.order || null;
                window.dispatchEvent(new CustomEvent('orders:changed', { detail: { order: updatedOrder } }));
            } catch (e) { /* ignore */ }

            setTimeout(() => onClose(), 1000);

        } catch (err) {
            console.error("Error inside handleAction:", err);
            setFeedback({ type: 'error', message: `Failed to ${intendedAction}: ${String(err.message || err)}` });
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

            <div className="mb-4 p-2 bg-[#1A1F30] rounded-lg">
                <DetailRow label="Quantity" value={`${initialQty} shares`} />
                <DetailRow  label="lots" value={`${lots} lots`} />
                <DetailRow  label="Avg. Buy Price" value={money(initialPrice)} colorClass="text-yellow-300" />
                <DetailRow  label="type" value={orderSide} colorClass={isBuy ? "text-green-400" : "text-red-400"} />
                <DetailRow  label="order instant" value={product === 'MIS' ? 'Intraday' : 'Overnight'} colorClass="text-gray-300" />
                <DetailRow  label="expire Date" value={formattedStockExpireDate} colorClass="text-gray-300" />
            </div>

            <div className="p-3 bg-[#1F2028] rounded-lg mb-4">
                <h4 className="text-lg font-semibold mb-3 text-white">Modify Holding</h4>

                <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                         <h6 className='text-lg font-semibold  text-white'>Lot</h6>
                        <input
                            type="number"
                            value={newLot}
                            onChange={(e) => setNewLot(e.target.value)}
                            placeholder="New Lots"
                            className="flex-1 p-2 bg-[#2A314A] text-white rounded-md transition"
                        />
                        <div className="text-xs text-gray-400 italic">Lot size: <span className="font-medium text-white ml-1">{currentLotSize}</span></div>
                    </div>

                    {/* Show computed avg price only (not editable) */}
                   {userRole === 'broker' && <div className="flex items-center">
                        <Hash className="w-5 h-5 text-gray-400 mr-2" />
                        <div className="w-full p-2 bg-[#2A314A] text-white rounded-md transition flex items-center justify-between">
                            <span className="text-sm">Avg. Price</span>
                            <span className="font-medium">{displayComputedAvg}</span>
                        </div>
                    </div>}
                </div>
            </div>

            <div className="flex space-x-2">
                <button
                    onClick={() => handleAction('Adjust')}
                    disabled={submitting}
                    className={`flex-1 p-3 rounded-lg text-white font-semibold transition ${adjustActionColor} ${submitting && action === 'Adjust' ? 'opacity-50' : ''}`}
                >
                    {submitting && action === 'Adjust' ? 'BUYING...' : 'BUY MORE'}
                </button>

                <button
                    onClick={() => handleAction('Close')}
                    disabled={submitting}
                    className={`flex-1 p-3 rounded-lg text-white font-semibold transition ${closeActionColor} ${submitting && action === 'Close' ? 'opacity-50' : ''}`}
                >
                    {submitting && action === 'Close' ? 'EXITING...' : 'EXIT'}
                </button>
            </div>
        </div>
    );
}
