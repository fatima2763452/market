import React, { useEffect, useState } from "react";
import { BarChart, Zap, ShoppingCart, DollarSign, Hash, XCircle, Clock, Layers, RefreshCw } from "lucide-react";

// --- Helpers ---
const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;
const signColor = (n) => (Number(n) > 0 ? "text-green-400" : Number(n) < 0 ? "text-red-400" : "text-gray-200");
const signSym = (n) => (Number(n) > 0 ? "+" : "");

// Logic to extract prices from Closed Order Data
const getOrderValues = (order) => {
    const qty = parseFloat(order.quantity) || 0;
    
    // Priority: average_price -> price
    let entryPrice = parseFloat(order.average_price);
    if (!entryPrice) entryPrice = parseFloat(order.price) || 0;

    // Exit: closed_ltp -> ltp
    let exitPrice = parseFloat(order.closed_ltp);
    if (!exitPrice) exitPrice = parseFloat(order.ltp) || 0;

    return { qty, entryPrice, exitPrice };
};

/* ---------------- Internal Component: Bottom Window (For Details/Reopen) ---------------- */
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

// const ClosedOrderBottomWindow = ({ selectedOrder, onClose }) => {
//     if (!selectedOrder) return null;

//     const [submitting, setSubmitting] = useState(false);
//     const [feedback, setFeedback] = useState(null);

//     const {
//         symbol, side, product, lots, lot_size, closed_at, _id: orderId,
//         security_Id, segment, quantity, price, came_From
//     } = selectedOrder;

//     const tradingsymbol = selectedOrder.meta?.selectedStock?.tradingSymbol ?? symbol ?? "N/A";
//     const orderSide = String(side ?? "").toUpperCase();
//     const productType = product === 'MIS' ? 'Intraday' : 'Overnight';
//     const { qty, entryPrice, exitPrice } = getOrderValues(selectedOrder);

//     // P&L Logic
//     const diff = orderSide === 'BUY' ? (exitPrice - entryPrice) : (entryPrice - exitPrice);
//     const pnl = diff * qty;
//     const isZero = Math.abs(pnl) < 0.01;
//     const pnlColor = isZero ? "text-gray-200" : (pnl > 0 ? "text-green-400" : "text-red-400");

//     const closedTime = closed_at ? new Date(closed_at).toLocaleString() : "—";

//     const handleReopen = async () => {
//         setSubmitting(true);
//         setFeedback(null);
//         try {
//             const activeContext = JSON.parse(localStorage.getItem('activeContext') || '{}');
//             const token = localStorage.getItem("token");
//             let apiBase = typeof window !== 'undefined' ? window.location.origin : '';
//             apiBase = apiBase.replace(/\/$/, "");
            
//             const res = await fetch(`${apiBase}/api/orders/updateOrder`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
//                 body: JSON.stringify({
//                     broker_id_str: activeContext.brokerId,
//                     customer_id_str: activeContext.customerId,
//                     order_id: orderId, security_Id, symbol: tradingsymbol, side: orderSide, product, segment,
//                     lots: String(lots), quantity: Number(quantity), price: Number(price),
//                     order_status: "OPEN", meta: { from: 'ui_closed_order_reopen' }
//                 })
//             });

//             const body = await res.json();
//             if (!res.ok || body.success === false) throw new Error(body?.message || 'Failed');

//             setFeedback({ type: 'success', message: 'Order Reopened!' });
//             window.dispatchEvent(new CustomEvent('orders:changed', { detail: { order: body?.order } }));
//             setTimeout(onClose, 1000);
//         } catch (err) {
//             setFeedback({ type: 'error', message: err.message });
//         } finally {
//             setSubmitting(false);
//         }
//     };

//     return (
//         <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#121A2B] border-t border-white/10 shadow-2xl p-4">
//             <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-2">
//                 <h3 className="text-xl text-white font-bold">{tradingsymbol} ({orderSide})</h3>
//                 <button onClick={onClose}><XCircle className="w-6 h-6 text-gray-400" /></button>
//             </div>
//             {feedback && <div className={`p-2 mb-3 rounded text-sm ${feedback.type === 'error' ? 'text-red-400 bg-red-900/20' : 'text-green-400 bg-green-900/20'}`}>{feedback.message}</div>}
            
//             <div className="mb-4 flex justify-between items-end">
//                 <div><p className="text-xl font-bold">{money(exitPrice)}</p><p className="text-xs text-gray-500">Exit Price</p></div>
//                 <div className="text-right"><p className={`text-xl font-bold ${pnlColor}`}>{money(pnl)}</p><p className="text-xs text-gray-500">Realized P&L</p></div>
//             </div>

//             <div className="mb-4 p-2 bg-[#1A1F30] rounded-lg">
//                 <DetailRow Icon={ShoppingCart} label="Quantity" value={qty} />
//                 <DetailRow Icon={DollarSign} label="Entry" value={money(entryPrice)} colorClass="text-yellow-300" />
//                 <DetailRow Icon={Zap} label="Type" value={orderSide} colorClass={orderSide === 'BUY' ? "text-green-400" : "text-red-400"} />
//                 <DetailRow Icon={Clock} label="Closed" value={closedTime} />
//             </div>

//             <div className="flex space-x-2">
//                 <button onClick={onClose} className="flex-1 p-3 rounded-lg bg-[#21283D] text-white border border-white/10">Close</button>
//                 {(came_From !== 'Hold' && came_From !== 'Overnight') && (
//                     <button onClick={handleReopen} disabled={submitting} className="flex-1 p-3 rounded-lg bg-blue-600 text-white flex justify-center items-center gap-2">
//                         {submitting ? "..." : <><RefreshCw className="w-4 h-4" /> To Open</>}
//                     </button>
//                 )}
//             </div>
//         </div>
//     );
// };

/* ---------------- Portfolio Item Card (The UI you want) ---------------- */
const PortfolioItem = ({ data, onClick }) => {
    const tradingsymbol = data?.meta?.selectedStock?.tradingSymbol ?? data?.symbol ?? "—";
    const { qty, entryPrice, exitPrice } = getOrderValues(data);
    const sideUpper = String(data.side ?? "").toUpperCase();

    // P&L Logic
    const diff = sideUpper === "BUY" ? (exitPrice - entryPrice) : (entryPrice - exitPrice);
    const pnl = diff * qty;
    const pct = entryPrice ? (diff / entryPrice) * 100 : 0;

    const pnlColor = signColor(pnl);

    return (
        <div 
            onClick={() => onClick(data)}
            className="relative bg-[#121a2b] p-4 rounded-xl shadow-md border border-white/10 hover:bg-[#172238] transition mb-3 cursor-pointer"
        >
            {/* Left purple accent bar (Portfolio Style) */}
            <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-fuchsia-500" />

            {/* Header Row */}
            <div className="flex justify-between items-center mb-2">
                <p className="text-base md:text-lg font-bold text-white tracking-wide">{tradingsymbol}</p>
                <p className={`text-sm md:text-base font-semibold ${pnlColor}`}>
                    {signSym(pnl)}{money(pnl)} 
                    <span className="text-[10px] ml-1 opacity-80">
                        ({signSym(pct)}{pct.toFixed(2)}%)
                    </span>
                </p>
            </div>

            {/* Details Row */}
            <div className="flex justify-between text-xs md:text-sm text-gray-300">
                <div className="space-y-1">
                    <p>
                        Qty: <span className="text-white font-medium">{qty}</span>
                    </p>
                    <p>
                        Entry Avg: <span className="text-white font-medium">{money(entryPrice)}</span>
                    </p>
                </div>
                <div className="space-y-1 text-right">
                    <p>
                        Exit Avg: <span className="text-white font-semibold">{money(exitPrice)}</span>
                    </p>
                    <p>
                         Type: <span className={`font-semibold ${sideUpper === 'BUY' ? 'text-blue-300' : 'text-orange-300'}`}>{sideUpper}</span>
                    </p>
                </div>
            </div>

            {/* Bottom Link Style */}
            <div className="mt-2 flex items-center text-fuchsia-300 hover:text-fuchsia-200 text-xs font-medium">
                <BarChart className="w-3 h-3 mr-1" />
                View Details
            </div>
        </div>
    );
};

/* ---------------- Main Portfolio Component ---------------- */
export default function Portfolio() {
    const [closedOrders, setClosedOrders] = useState([]);
    const [summary, setSummary] = useState({ invested: 0, current: 0, totalPnl: 0 });
    const [loader, setLoader] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);

    // API Params
    const activeContext = JSON.parse(localStorage.getItem('activeContext') || '{}');
    const { brokerId, customerId } = activeContext;
    const token = localStorage.getItem("token");

    const fetchClosedOrders = async () => {
        if (!brokerId || !customerId) { setLoader(false); return; }
        setLoader(true);
        try {
            let baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
            baseUrl = baseUrl.replace(/\/$/, "");
            const res = await fetch(`${baseUrl}/api/orders/getOrderInstrument?broker_id_str=${brokerId}&customer_id_str=${customerId}&orderStatus=CLOSED`, {
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            });

            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            const orders = Array.isArray(data?.ordersInstrument) ? data.ordersInstrument : [];
            const sortedOrders = orders.sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));
            
            setClosedOrders(sortedOrders);
            calculateSummary(sortedOrders);
        } catch (err) {
            console.error(err);
        } finally {
            setLoader(false);
        }
    };

    const calculateSummary = (orders) => {
        const acc = orders.reduce((a, order) => {
            const { qty, entryPrice, exitPrice } = getOrderValues(order);
            const side = String(order.side ?? "").toUpperCase();
            
            // For summary
            const investAmount = entryPrice * qty;
            const realizedAmount = exitPrice * qty;
            const diff = side === 'BUY' ? (exitPrice - entryPrice) : (entryPrice - exitPrice);
            const pnl = diff * qty;

            a.invested += investAmount;
            a.current += realizedAmount; // Logic: This is "Realized Value"
            a.totalPnl += pnl;
            return a;
        }, { invested: 0, current: 0, totalPnl: 0 });

        setSummary(acc);
    };

    useEffect(() => {
        fetchClosedOrders();
        const handler = () => fetchClosedOrders();
        window.addEventListener('orders:changed', handler);
        return () => window.removeEventListener('orders:changed', handler);
    }, [brokerId, customerId]);

    const totalColor = signColor(summary.totalPnl);

    return (
        <div className="flex flex-col min-h-screen bg-[#0b1020] text-white overflow-hidden">
            <h2 className="text-lg md:text-xl font-semibold text-[26px] ml-3 mt-2">Portfolio</h2>

            <div className="flex-1 overflow-y-auto px-4 pb-24 mt-3">
                {/* Summary Card (Portfolio Style) */}
                <div className="bg-[#121a2b] p-5 rounded-xl shadow mb-6 border border-white/10">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-gray-400 text-sm">Total Invested</p>
                            <p className="text-xl font-bold">{money(summary.invested)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-gray-400 text-sm">Realized Value</p>
                            <p className="text-xl font-bold">{money(summary.current)}</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-white/10">
                        <p className="text-gray-400 text-sm">Total Realized P&L</p>
                        <p className={`text-lg font-bold ${totalColor}`}>
                            {signSym(summary.totalPnl)}
                            {Number(summary.totalPnl).toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* List Header */}
                <h3 className="text-base font-semibold mb-3">Closed Positions ({closedOrders.length})</h3>

                {/* The List */}
                {loader && <div className="text-center text-gray-500 text-sm">Loading...</div>}
                
                {!loader && closedOrders.map((order, idx) => (
                    <PortfolioItem 
                        key={order._id || idx} 
                        data={order} 
                        onClick={setSelectedOrder} 
                    />
                ))}

                {!loader && closedOrders.length === 0 && (
                    <div className="text-gray-400 bg-fuchsia-900/20 border border-fuchsia-700 rounded-lg p-3 text-sm text-center">
                        No closed positions found.
                    </div>
                )}
            </div>

            {/* Helper Window */}
            {/* {selectedOrder && (
                <ClosedOrderBottomWindow 
                    selectedOrder={selectedOrder} 
                    onClose={() => setSelectedOrder(null)} 
                />
            )} */}
        </div>
    );
}