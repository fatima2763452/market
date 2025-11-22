import { io } from "socket.io-client";
import { useRef, useState, useEffect, useMemo } from "react";

export function useMarketTicks(url, opts = {}) {
  const socket = useRef(null);
  const [ticks, setTicks] = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);

  // Store opts in ref to avoid recreating socket on every render
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  // Simplified subscribe function. Assumes component checks for connection.
  async function subscribe(list, subscriptionType = 'full') {
    if (socket.current?.connected) {
      socket.current.emit("subscribe", list, subscriptionType);
    } else {
      console.warn("[useMarketTicks] Subscribe called while socket is not connected.");
    }
  }

  async function unsubscribe(list, subscriptionType = 'full') {
    if (socket.current?.connected) {
      socket.current.emit("unsubscribe", list, subscriptionType);
    }
  }

  // Effect for socket setup and cleanup
  useEffect(() => {
    console.log("[useMarketTicks] useEffect RUNNING. Creating new socket...");

    const newSocket = io(url, {
      ...optsRef.current,
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });
    socket.current = newSocket;

    const onConnect = () => {
      console.log("✅ market connected:", newSocket.id);
      setIsConnected(true);
    };

    const onDisconnect = (reason) => {
      console.log("❌ market disconnected:", reason);
      setIsConnected(false);
    };

    const onMarketUpdate = (update) => {
      if (update?.securityId && update?.exchangeSegment !== undefined) {
        setTicks((prev) => {
          const copy = new Map(prev);
          const key = `${update.exchangeSegment}-${update.securityId}`;
          // Merge new data with old, so partial updates (like OI) don't wipe other fields
          const existing = copy.get(key) || {};
          copy.set(key, { ...existing, ...update });
          return copy;
        });
      }
    };

    newSocket.on("connect", onConnect);
    newSocket.on("market_update", onMarketUpdate);
    newSocket.on("index_update", onMarketUpdate);
    newSocket.on("ticker_update", onMarketUpdate);
    newSocket.on("quote_update", onMarketUpdate);
    newSocket.on("oi_update", onMarketUpdate);
    newSocket.on("prev_close_update", onMarketUpdate);
    newSocket.on("market_status_update", onMarketUpdate);
    newSocket.on("disconnect", onDisconnect);

    return () => {
      console.log(`[useMarketTicks] useEffect CLEANUP function called. Disconnecting socket ${newSocket.id}.`);
      newSocket.off("connect", onConnect);
      newSocket.off("market_update", onMarketUpdate);
      newSocket.off("index_update", onMarketUpdate);
      newSocket.off("ticker_update", onMarketUpdate);
      newSocket.off("quote_update", onMarketUpdate);
      newSocket.off("oi_update", onMarketUpdate);
      newSocket.off("prev_close_update", onMarketUpdate);
      newSocket.off("market_status_update", onMarketUpdate);
      newSocket.off("disconnect", onDisconnect);
      newSocket.disconnect();
      socket.current = null;
    };
  }, [url]);

  return { ticks, subscribe, unsubscribe, isConnected };
}
