// OpenOrder.jsx
import React, { useEffect, useState, useMemo } from "react";
import { MOCK_ORDERS } from "../mockData";
import { useMarketData } from "../../../contexts/MarketDataContext.jsx";

import OvernightOrderBottomWindow from "./OvernightOrderBottomWindow.jsx";

const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;

export default function OvernightOrder() {
    const list = MOCK_ORDERS.filter(o => o.status === "HOLD");

  const [allData, setAllData] = useState([]);
  const [orders, setOrders] = useState({}); // snapshot map/object
  const [instrumentData, setInstrumentData] = useState([]);
  const [loader , setLoader] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrderData,  setSelectedOrderData] = useState(null);

  // Add WebSocket connection
  const { ticks, subscribe, unsubscribe, isConnected } = useMarketData();

  const activeContextString = localStorage.getItem('activeContext');
  const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
  const brokerId = activeContext.brokerId;
  const customerId = activeContext.customerId;
    // Normalize status to match backend enum values
    const orderStatus = "HOLD";

  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
  const token = localStorage.getItem("token") || null;

  // Segment mapping for tick key generation
  const segmentStringToNumberMap = useMemo(() => ({
    "NSE_EQ": 1,
    "NSE_FNO": 2,
    "MCX_COMM": 5,
    "BSE_EQ": 4,
    "NSE_INDEX": 0,
    "IDX_I": 0,
  }), []);

    const handleOrderSelect = (orderData) => {
        setSelectedOrderData(orderData);
    };

    const handleCloseWindow = () => {
        setSelectedOrderData(null);
    };

    // get instrumentData (extracted to a reusable function so we can re-run it)
    const fetchInstrumentData = async () => {
        setLoader(true);
        try {
            // Fetch only overnight (NRML) orders from backend
            const endPoint = `${apiBase.replace(/\/$/, "")}/api/orders/getOrderInstrument?broker_id_str=${brokerId}&customer_id_str=${customerId}&orderStatus=${orderStatus}&product=NRML`;

            const res = await fetch(endPoint, {
                method: "GET",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
            });

            if (!res.ok) {
                let text = "<no-body>";
                try { text = await res.text(); } catch (e) {}
                console.error("getOrderInstrument failed:", res.status, res.statusText, text);
                setInstrumentData([]);
                setError("Failed to load instruments");
                return;
            }

            const data = await res.json();
            const instruments = Array.isArray(data?.ordersInstrument) ? data.ordersInstrument : (Array.isArray(data) ? data : []);
            setInstrumentData(instruments);
            setError(null);
        } catch (err) {
            console.error("getOrderInstrument exception:", err);
            setInstrumentData([]);
            setError(String(err));
        } finally {
            setLoader(false);
        }
    };

    useEffect(() => {
        // initial fetch
        fetchInstrumentData();
        // we intentionally keep dependencies minimal so fetchInstrumentData can be called by event handler
    }, [brokerId, customerId, apiBase, token]);

    // Listen for 'orders:changed' events so that when an order is modified elsewhere
    // the open orders list will automatically refetch and stay up-to-date.
    useEffect(() => {
        const handler = (e) => {
            try {
                console.debug('[OpenOrder] orders:changed received, refetching orders');
                fetchInstrumentData();
            } catch (err) {
                console.warn('[OpenOrder] orders:changed handler error', err);
            }
        };

        window.addEventListener('orders:changed', handler);
        return () => window.removeEventListener('orders:changed', handler);
    }, [brokerId, customerId, apiBase, token]);

  // Subscribe to WebSocket and fetch snapshot when instrumentData ready
  useEffect(() => {
//     console.log("[OpenOrder] instrument (raw object):", instrumentData);
    if (!Array.isArray(instrumentData) || instrumentData.length === 0) {
      console.log("[OpenOrder] instrument is not array or is empty");
      setOrders({});
      return;  
    }

    (async () => {
      try {
        // Normalize: accept either securityId or security_Id (defensive)
        const items = instrumentData
          .map(item => {
            const segment = item.segment ?? item.exchange ?? null;
            // your data uses `security_Id` in many places — accept both
            const rawSecurityId = item.securityId ?? item.security_Id ?? item.id ?? null;
            if (!segment || rawSecurityId == null) return null;
            return { segment, securityId: String(rawSecurityId) };
          })
          .filter(Boolean);

//         console.log("[OpenOrder] snapshot items (to send):", items);

        if (items.length === 0) {
          console.log("[OpenOrder] items array empty");
          setOrders({});
          return;
        }

        // 1️⃣ SUBSCRIBE TO WEBSOCKET FIRST (Critical!)
        try {
          console.log(`[OpenOrder] Subscribing to ${items.length} instruments via WebSocket...`);
          await subscribe(items, 'quote'); // Use 'quote' for lightweight live data
          console.log("[OpenOrder] ✅ WebSocket subscription successful");
        } catch (e) {
          console.warn("[OpenOrder] ⚠️ WebSocket subscribe failed:", e?.message || e);
        }

        // 2️⃣ THEN FETCH SNAPSHOT
        const url = `${apiBase.replace(/\/$/, "")}/api/quotes/snapshot`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: "include",
          body: JSON.stringify({ items }),
        });

        if (!res.ok) {
          let text = "<no-body>";
          try { text = await res.text(); } catch (e) {}
          console.error("[OpenOrder] snapshot fetch failed:", res.status, res.statusText, text);
          setOrders({});
          return;
        }

        const snapshotData = await res.json();
//         console.log("[OpenOrder] Snapshot (raw):", snapshotData);

        let snapshotMap = {};
        if (snapshotData && typeof snapshotData === "object" && !Array.isArray(snapshotData)) {
          snapshotMap = snapshotData;
        } else if (Array.isArray(snapshotData)) {
          snapshotData.forEach(it => {
            const id = String(it.securityId ?? it.security_Id ?? it.id ?? "");
            if (id) snapshotMap[id] = it;
            if (it.segment && id) snapshotMap[`${it.segment}|${id}`] = it;
          });
        }

        setOrders(snapshotMap);

      } catch (err) {
        console.error("[OpenOrder] snapshot fetch exception:", err);
        setOrders({});
      }
    })();

    // 3️⃣ CLEANUP: Unsubscribe when component unmounts or instruments change
    return () => {
      const items = instrumentData
        .map(item => ({
          segment: item.segment ?? item.exchange ?? null,
          securityId: String(item.securityId ?? item.security_Id ?? item.id ?? null),
        }))
        .filter(i => i.segment && i.securityId);

      if (items.length > 0) {
        console.log(`[OpenOrder] Unsubscribing from ${items.length} instruments...`);
        unsubscribe(items, 'quote').catch(e => console.warn("[OpenOrder] Unsubscribe failed:", e));
      }
    };
  }, [instrumentData, subscribe, unsubscribe, apiBase, token]);

  // Merge instrument + snapshot + real-time tick data
  useEffect(() => {
    if (!instrumentData || instrumentData.length === 0) {
      setAllData([]);
      return;
    }

    const merged = instrumentData.map(inst => {
      const securityKey = String(inst.security_Id ?? inst.securityId ?? inst.id ?? "");
      let snapshot = null;

      // Get snapshot data from API
      if (orders && typeof orders === 'object') {
        // try direct id
        snapshot = orders[securityKey] ?? orders[String(inst.securityId ?? "")] ?? null;
       
        if (!snapshot && inst.segment) {
          snapshot = orders[`${inst.segment}|${securityKey}`] ?? null;
        }
     
        if (!snapshot) {
          for (const k of Object.keys(orders)) {
            const v = orders[k];
            if (!v) continue;
            const vid = String(v.securityId ?? v.security_Id ?? v.id ?? "");
            if (vid && vid === securityKey) {
              snapshot = v;
              break;
            }
          }
        }
      }

      // Get real-time tick data from WebSocket
      const numericSegment = segmentStringToNumberMap[inst.segment];
      const tickKey = `${numericSegment}-${securityKey}`;
      const tick = ticks.get(tickKey) || {};

     
      const combined = { ...snapshot, ...tick };

      return { ...inst, snapshot: combined };
    });

    setAllData(merged);
//     console.log('[OpenOrder] Merged allData (snapshot + ticks):', merged);
  }, [instrumentData, orders, ticks, segmentStringToNumberMap]);


  const selectedOrderMarketData = useMemo(() => {
    if (!selectedOrderData) return {};
    
   
    const foundItem = allData.find(item => 
      item._id === selectedOrderData._id || 
      (item.security_Id && item.security_Id === selectedOrderData.security_Id)
    );
    
    return foundItem?.snapshot ?? {};
  }, [selectedOrderData, allData]);


  const displayList = (Array.isArray(allData) && allData.length > 0) ? allData : list;
    return (
        <>
            <h3 className="text-gray-400 text-sm mb-2">Overnight Orders ({displayList.length})</h3>
      <ul className="space-y-2 pb-24 overflow-auto">
        {
          displayList.map((data, idx) =>{
            const tradingsymbolRaw = data?.meta?.selectedStock?.tradingSymbol ?? data?.symbol ?? "";
            const tradingsymbol = String(tradingsymbolRaw ?? "");
            const ltp = Number(data.snapshot?.ltp ?? data.ltp ?? 0);

            const avg = Number(data.price ?? 0);
            const qty = Number(data?.quantity ?? 0);

            const sideUpper = String(data.side ?? "").toUpperCase();

            const diff = sideUpper === "BUY" ? (ltp - avg) : (avg - ltp);
            const pnl = diff * qty;
            const pct = avg ? (diff / avg) * 100 : 0;
            const profit = pnl >= 0;
            const pnlColor = profit ? "text-green-400" : "text-red-400";
            const pctText = `${profit ? '+' : ''}${pnl.toFixed(2)} (${profit ? '+' : ''}${pct.toFixed(2)}%)`;

             return (
              <li
                key={data._id || data.id || `${data.segment}-${data.security_Id}-${idx}`}
                className="relative bg-[#121a2b] rounded-lg p-3 border border-white/10 hover:bg-[#222a41] transition cursor-pointer"
                onClick={() => handleOrderSelect(data)}
              >
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-fuchsia-500/90" />
                <div className="flex items-start justify-between">
                  <h4 className="text-white font-bold tracking-wide text-sm">{tradingsymbol || '—'}</h4>
                  <div className={`text-xs font-bold ${pnlColor}`}>{pctText}</div>
                </div>

                <div className="mt-1 grid grid-cols-2 gap-y-1 text-[12px]">
                  <div className="text-gray-400">Qty: <span className="text-white">{qty}</span></div>
                  <div className="text-right text-gray-400">LTP: <span className="text-white font-semibold">{ltp ? `₹${ltp.toFixed(2)}` : '—'}</span></div>
                  <div className="text-gray-400">Avg: <span className="text-white">{money(avg)}</span></div>
                  <div className="text-right text-gray-400">Total P&L: <span className={`${pnlColor} font-semibold`}>{money(pnl)}</span></div>
                </div>

              </li>
            );
          })
        }
      </ul>
      

            {selectedOrderData && (
                <OvernightOrderBottomWindow
                    selectedOrder={selectedOrderData}
                    onClose={handleCloseWindow}
                    sheetData={selectedOrderMarketData}
                />
            )}
    </>
  );
}