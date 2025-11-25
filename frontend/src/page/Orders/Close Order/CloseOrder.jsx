

import React, { useEffect, useState } from "react";
import { ShoppingCart, DollarSign, Hash, Zap, XCircle, Clock, Layers, RefreshCw } from 'lucide-react';
import ClosedOrderFilter from "./CloseOrderFilter"; // make sure path is correct


const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;

// --- Helper to ensure consistent math everywhere ---
const getOrderValues = (order) => {
    const qty = parseFloat(order.quantity) || 0;

    // Priority: average_price -> price (limit/trigger)
    let entryPrice = parseFloat(order.average_price);
    if (!entryPrice) {
        entryPrice = parseFloat(order.price) || 0;
    }

    // Exit: closed_ltp -> ltp -> 0
    let exitPrice = parseFloat(order.closed_ltp);
    if (!exitPrice) {
        exitPrice = parseFloat(order.ltp) || 0;
    }

    return { qty, entryPrice, exitPrice };
};

// --- Internal Component: ClosedOrderBottomWindow ---

const DetailRow = ({ Icon, label, value, colorClass = "text-white/90" }) => (
    <div className="flex justify-between items-center py-1 border-b border-white/5 last:border-b-0">
        <div className="flex items-center text-gray-400 text-sm">
            <Icon className="w-4 h-4 mr-2 text-indigo-400" />
            {label}
        </div>
        <span className={`font-medium text-sm ${value === '—' ? 'text-gray-500' : colorClass}`}>
            {value}
        </span>
    </div>
);

const ClosedOrderBottomWindow = ({ selectedOrder, onClose }) => {
    if (!selectedOrder) {
        return null;
    }

    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const expireDate = selectedOrder.meta?.selectedStock?.expiry; // iso formate

    const date = expireDate ? new Date(expireDate) : null;
    const formattedStockExpireDate = date ? (
        String(date.getDate()).padStart(2, '0') + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        date.getFullYear()
    ) : "—";

    const {
        symbol,
        side,
        product,
        lots,
        lot_size,
        closed_at,
        _id: orderId, // Ensure we have the ID for API call
        security_Id,
        segment,
        quantity,
        price,
        order_category,
        came_From
    } = selectedOrder;

    const tradingsymbol = selectedOrder.meta?.selectedStock?.tradingSymbol ?? symbol ?? "N/A";
    const orderSide = String(side ?? "").toUpperCase();
    const productType = product === 'MIS' ? 'Intraday' : 'Overnight';

    const { qty, entryPrice, exitPrice } = getOrderValues(selectedOrder);

    // P&L Calculation
    let diff = 0;
    if (orderSide === 'BUY') {
        diff = exitPrice - entryPrice;
    } else {
        diff = entryPrice - exitPrice;
    }
    const pnl = diff * qty;

    const isZero = Math.abs(pnl) < 0.01;
    const profit = pnl > 0;
    let pnlColor = "text-gray-200";
    if (!isZero) {
        pnlColor = profit ? "text-green-400" : "text-red-400";
    }

    const closedTime = closed_at ? (() => {
        const d = new Date(closed_at);
        const datePart =
            String(d.getDate()).padStart(2, "0") + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            d.getFullYear();

        const timePart = d.toLocaleTimeString();

        return `${datePart}, ${timePart}`;
    })() : "—";


    // --- REOPEN LOGIC ---
    const handleReopen = async () => {
        setSubmitting(true);
        setFeedback(null);

        try {
            // Context & Config
            const activeContextString = localStorage.getItem('activeContext');
            const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
            const brokerId = activeContext.brokerId;
            const customerId = activeContext.customerId;
            const token = localStorage.getItem("token") || null;
            // API Base setup
            let apiBase = "";
            // If using vite env, uncomment: 
            // apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
            // Fallback for current setup:
            if (!apiBase) {
                apiBase = typeof window !== 'undefined' ? window.location.origin : '';
            }
            apiBase = apiBase.replace(/\/$/, "");

            const endpoint = `${apiBase}/api/orders/updateOrder`;


            const payload = {
                broker_id_str: brokerId,
                customer_id_str: customerId,
                order_id: orderId,
                security_Id: security_Id,
                symbol: tradingsymbol,
                side: orderSide,
                product: product, // 'MIS' or 'NRML'
                segment: segment, // Pass segment if available
                lots: String(lots),
                quantity: Number(quantity),
                price: Number(price), // Entry price preserved
                order_status: "OPEN", // Changing status back to OPEN
                meta: { from: 'ui_closed_order_reopen' }
            };

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
                throw new Error(body?.message || body?.error || `Server error: ${res.status}`);
            }

            if (body && body.success === false) {
                throw new Error(body.message || 'Server returned failure');
            }

            // Success
            setFeedback({ type: 'success', message: 'Order Reopened Successfully!' });

            // Notify app to refresh lists
            try {
                window.dispatchEvent(new CustomEvent('orders:changed', { detail: { order: body?.order } }));
            } catch (e) { }

            // Close window after short delay
            setTimeout(() => {
                onClose();
            }, 1000);

        } catch (err) {
            console.error("Reopen error:", err);
            setFeedback({ type: 'error', message: `Failed to reopen: ${err.message}` });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="open-order-bottom-window fixed bottom-0 left-0 right-0 z-50 bg-[#121A2B] border-t border-white/10 shadow-2xl p-4 transition-transform duration-300">
            {/* Header section */}
            <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-2">
                <h3 className="text-xl text-white font-bold tracking-wide">
                    {tradingsymbol} ({orderSide})
                </h3>
                <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-white transition">
                    <XCircle className="w-6 h-6" />
                </button>
            </div>

            {/* Feedback Message */}
            {feedback && (
                <div className={`p-2 mb-3 rounded-md text-sm ${feedback.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {feedback.message}
                </div>
            )}

            {/* P&L Display Section */}
            <div className="mb-4 flex justify-between items-end">
                <div>
                    <p className="text-xl font-bold">
                        <span className="text-gray-300 mr-1">₹</span>
                        <span className={pnlColor}>
                            {exitPrice.toFixed(2)}
                        </span>
                    </p>
                    <p className="text-xs text-gray-500">Exit Price</p>
                </div>
                <div className="text-right">
                    <p className={`text-xl font-bold ${pnlColor}`}>{money(pnl)}</p>
                    <p className="text-xs text-gray-500">Realized P&L</p>
                </div>
            </div>

            {/* Details Grid */}
            <div className="mb-4 p-2 bg-[#1A1F30] rounded-lg">
                <DetailRow Icon={ShoppingCart} label="Quantity" value={`${qty} shares`} />
                <DetailRow Icon={Layers} label="Lots (Size)" value={`${lots ?? '-'} (${lot_size ?? '-'})`} />

                <DetailRow Icon={DollarSign} label="Entry Price" value={money(entryPrice)} colorClass="text-yellow-300" />
                <DetailRow Icon={DollarSign} label="Exit Price" value={money(exitPrice)} colorClass="text-white" />

                <DetailRow Icon={Zap} label="Type" value={orderSide} colorClass={orderSide === 'BUY' ? "text-green-400" : "text-red-400"} />
                <DetailRow Icon={Hash} label="Product" value={productType} colorClass="text-indigo-300" />
                <DetailRow Icon={Hash} label="from" value={came_From} colorClass="text-indigo-300" />


                <DetailRow Icon={Clock} label="Closed At" value={closedTime} colorClass="text-gray-400 text-xs" />
                <DetailRow Icon={Clock} label="expire Date" value={formattedStockExpireDate} colorClass="text-gray-400 text-xs" />

            </div>

            {/* Actions: Close Window & To Open */}
            <div className="flex space-x-2">
                <button
                    onClick={onClose}
                    className="flex-1 p-3 rounded-lg bg-[#21283D] text-white font-semibold hover:bg-[#2A314A] transition border border-white/10"
                >
                    Close
                </button>

                {(came_From !== 'Hold' && came_From !== 'Overnight') && (
                    <button
                        onClick={handleReopen}
                        disabled={submitting}
                        className={`flex-1 p-3 rounded-lg font-semibold text-white transition flex items-center justify-center gap-2
      ${submitting ? 'bg-blue-600/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20'}`}
                    >
                        {submitting ? (
                            <>Processing...</>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4" />
                                To Open
                            </>
                        )}
                    </button>
                )}

            </div>
        </div>
    );
};

// --- Main Component: ClosedOrder ---

export default function ClosedOrder() {

    const [closedOrders, setClosedOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [loader, setLoader] = useState(true);
    const [error, setError] = useState(null);
    const [selectedOrderData, setSelectedOrderData] = useState(null);

    const activeContextString = localStorage.getItem('activeContext');
    const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
    const brokerId = activeContext.brokerId;
    const customerId = activeContext.customerId;

    const orderStatus = "CLOSED";

    // API Handling
    const apiBase = "";
    const token = localStorage.getItem("token") || null;

    const handleOrderSelect = (orderData) => {
        setSelectedOrderData(orderData);
    };

    const handleCloseWindow = () => {
        setSelectedOrderData(null);
    };

    const fetchClosedOrders = async () => {

        if (!brokerId || !customerId) {
            setLoader(false);
            return;
        }

        setLoader(true);
        try {
            let baseUrl = apiBase;
            if (!baseUrl) {
                baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
            }
            baseUrl = baseUrl.replace(/\/$/, "");

            const endPoint = `${baseUrl}/api/orders/getOrderInstrument?broker_id_str=${brokerId}&customer_id_str=${customerId}&orderStatus=${orderStatus}`;

            const res = await fetch(endPoint, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                credentials: "include",
            });

            if (!res.ok) {
                setClosedOrders([]);
                setFilteredOrders([]);
                setError("Failed to load closed orders");
                return;
            }

            const data = await res.json();
            const orders = Array.isArray(data?.ordersInstrument) ? data.ordersInstrument : (Array.isArray(data) ? data : []);

            const sortedOrders = orders.sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));

            setClosedOrders(sortedOrders);
            setFilteredOrders(sortedOrders.slice());
            setError(null);
        } catch (err) {
            console.error("fetchClosedOrders exception:", err);
            setClosedOrders([]);
            setFilteredOrders([]);
            setError(String(err));
        } finally {
            setLoader(false);
        }
    };

    useEffect(() => {
        fetchClosedOrders();

        const handler = () => fetchClosedOrders();
        window.addEventListener('orders:changed', handler);
        return () => window.removeEventListener('orders:changed', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [brokerId, customerId, apiBase, token]);


    return (
        <>
            <div className="grid md:grid-cols-[320px_1fr] gap-4">
                <div>
                    <ClosedOrderFilter
                        closedOrders={closedOrders}
                        onFilter={(newList) => setFilteredOrders(newList)}
                    />
                </div>

                <div>
                    <h3 className="text-gray-400 text-sm mb-2">Closed Orders ({filteredOrders.length})</h3>

                    {loader && filteredOrders.length === 0 ? (
                        <div className="text-gray-500 text-center py-4 text-xs">Loading history...</div>
                    ) : (
                        <ul className="space-y-2 pb-24 overflow-auto">
                            {filteredOrders.map((data, idx) => {
                                const tradingsymbolRaw = data?.meta?.selectedStock?.tradingSymbol ?? data?.symbol ?? "";
                                const tradingsymbol = String(tradingsymbolRaw ?? "");

                                // Use helper to get clean numbers
                                const { qty, entryPrice, exitPrice } = getOrderValues(data);

                                const sideUpper = String(data.side ?? "").toUpperCase();

                                let diff = 0;
                                if (sideUpper === "BUY") {
                                    diff = exitPrice - entryPrice;
                                } else {
                                    diff = entryPrice - exitPrice;
                                }

                                // Calculate P&L
                                const pnl = diff * qty;

                                // Calculate percentage return
                                const pct = entryPrice ? (diff / entryPrice) * 100 : 0;

                                // Check if effectively zero
                                const isZero = Math.abs(pnl) < 0.01;
                                const profit = pnl > 0;

                                // Color: Green if +, Red if -, Gray if 0
                                let pnlColor = "text-gray-200";
                                if (!isZero) {
                                    pnlColor = profit ? "text-green-400" : "text-red-400";
                                }

                                // Format Text
                                const pctText = `${profit && !isZero ? '+' : ''}${pnl.toFixed(2)} (${profit && !isZero ? '+' : ''}${pct.toFixed(2)}%)`;

                                return (
                                    <li
                                        key={data._id || idx}
                                        className="relative bg-[#121a2b] rounded-lg p-3 border border-white/10 hover:bg-[#222a41] transition cursor-pointer"
                                        onClick={() => handleOrderSelect(data)}
                                    >
                                        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-fuchsia-500/90" />

                                        <div className="flex items-start justify-between">
                                            <h4 className="text-white font-bold tracking-wide text-sm">
                                                {tradingsymbol || '—'}
                                            </h4>
                                            <div className={`text-xs font-bold ${pnlColor}`}>{pctText}</div>
                                        </div>

                                        <div className="mt-1 grid grid-cols-2 gap-y-1 text-[12px]">
                                            {/* Qty and Exit */}
                                            <div className="text-gray-400">Qty: <span className="text-white">{qty}</span></div>
                                            <div className="text-right text-gray-400">Exit: <span className="text-white font-semibold">{money(exitPrice)}</span></div>

                                            {/* Lots and Avg */}
                                            <div className="text-gray-400">
                                                Lots: <span className="text-white">{data.lots ?? '-'}</span>
                                                <span className="text-gray-500 ml-1 text-[10px]">({data.lot_size ?? '-'})</span>
                                            </div>
                                            <div className="text-right text-gray-400">Avg: <span className="text-white">{money(entryPrice)}</span></div>

                                            {/* Total P&L Row */}
                                            <div className="col-span-2 text-right pt-1 mt-1 border-t border-white/5">
                                                <span className="text-gray-400 mr-2">Total P&L:</span>
                                                <span className={`${pnlColor} font-semibold text-sm`}>{money(pnl)}</span>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}

                            {!loader && filteredOrders.length === 0 && (
                                <div className="text-gray-600 text-center py-8 text-sm italic">
                                    No closed positions found.
                                </div>
                            )}
                        </ul>
                    )}

                    {selectedOrderData && (
                        <ClosedOrderBottomWindow
                            selectedOrder={selectedOrderData}
                            onClose={handleCloseWindow}
                        />
                    )}
                </div>
            </div>
        </>
    );
}
