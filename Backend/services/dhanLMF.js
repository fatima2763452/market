// services/dhanLMF.js
import WebSocket from "ws";
import { config } from "../config.js";
import { getIO } from "../sockets/io.js";
import { onMarketTick } from "../Utils/OrderManager.js";
// import { fundOnMarketTick } from "../Utils/fundrenewManager.js";

const roomFor = (securityId) => `sec:${securityId}`;

function segToCode(seg) {
  const m = {
    "NSE_EQ": 1,
    "NSE_FNO": 2,
    "MCX_COMM": 5,
  };
  return m[String(seg).toUpperCase()] ?? null;
}

export class DhanLMF {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.subscriptionQueue = []; // Queue for pending subscriptions
    this.last = new Map();
    this.heartbeatInterval = null;
  }

  get ns() {
    return getIO().of("/market");
  }

  setToken(newToken) { config.dhan.token = newToken; }

  subscribe(list, subscriptionType = 'full') {
    if (!Array.isArray(list) || !list.length) return;

    // Removed spamming log: Subscription request received

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Removed spamming log: WebSocket not open
      this.subscriptionQueue.push({ list, subscriptionType });
      if (this.ws?.readyState !== WebSocket.CONNECTING) {
        this.connect();
      }
      return;
    }
    
    this.sendSubscription(list, subscriptionType);
  }

  sendSubscription(list, subscriptionType = 'full') {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Removed spamming log: WS not open
      return;
    }
    if (!list?.length) {
        // Removed spamming log: No instruments to subscribe
        return;
    }

    const subscriptionTypeToCode = {
      'ticker': 15,
      'quote': 17,
      'full': 21,
    };

    const requestCode = subscriptionTypeToCode[subscriptionType] || 21;

    const instrumentsToSubscribe = list.map(inst => {
      let exchangeSegment = String(inst.segment || "").toUpperCase();
      
      // Convert segment names to Dhan's exchange segment format
      if (inst.segment === 'NSE_INDEX' || inst.segment === 'BSE_INDEX') {
        exchangeSegment = 'IDX_I';
      }
      
      return {
        ExchangeSegment: exchangeSegment,
        SecurityId: String(inst.securityId || "")
      };
    });

    console.log(`[LMF SUBSCRIBE] Type: ${subscriptionType}, Code: ${requestCode}, Instruments:`, 
      instrumentsToSubscribe.map(i => `${i.ExchangeSegment}:${i.SecurityId}`).join(', '));

    const chunkSize = 100;
    for (let i = 0; i < instrumentsToSubscribe.length; i += chunkSize) {
        const chunk = instrumentsToSubscribe.slice(i, i + chunkSize);
        
        const subscriptionPacket = {
            RequestCode: requestCode,
            InstrumentCount: chunk.length,
            InstrumentList: chunk
        };

        try {
            this.ws.send(JSON.stringify(subscriptionPacket));
            // Removed spamming log: Sent JSON subscription
        } catch (e) {
            console.warn("[LMF] JSON subscription send failed:", e?.message || e);
        }
    }
  }

  unsubscribe(list, subscriptionType = 'full') {
    if (!Array.isArray(list) || !list.length) return;

    // Removed spamming log: Unsubscription request received

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Removed spamming log: WebSocket not open
      return;
    }
    
    this.sendUnsubscription(list, subscriptionType);
  }

  sendUnsubscription(list, subscriptionType = 'full') {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Removed spamming log: WS not open
      return;
    }
    if (!list?.length) {
        // Removed spamming log: No instruments to unsubscribe
        return;
    }

    const unsubscriptionTypeToCode = {
      'ticker': 16,
      'quote': 18,
      'full': 22,
    };

    const requestCode = unsubscriptionTypeToCode[subscriptionType] || 22;

    const instrumentsToUnsubscribe = list.map(inst => ({
        ExchangeSegment: inst.segment === 'NSE_INDEX' ? 'IDX_I' : String(inst.segment || "").toUpperCase(),
        SecurityId: String(inst.securityId || "")
    }));

    const chunkSize = 100;
    for (let i = 0; i < instrumentsToUnsubscribe.length; i += chunkSize) {
        const chunk = instrumentsToUnsubscribe.slice(i, i + chunkSize);
        
        const unsubscriptionPacket = {
            RequestCode: requestCode,
            InstrumentCount: chunk.length,
            InstrumentList: chunk
        };

        try {
            this.ws.send(JSON.stringify(unsubscriptionPacket));
            // Removed spamming log: Sent JSON unsubscription
        } catch (e) {
            console.warn("[LMF] JSON unsubscription send failed:", e?.message || e);
        }
    }
  }

  async connect() { await this._openSocket(); }
  close() { try { this.ws?.terminate(); } catch {} this.ws = null; }

  getSnapshot(ids = []) {
    const out = {};
    for (const id of ids) out[String(id)] = this.last.get(String(id)) || this._empty();
    return out;
  }

  _empty() {
    return {
      ltp:null, open:null, high:null, low:null, close:null, volume:null, oi:null,
      bestBidPrice:null, bestBidQuantity:null, bestAskPrice:null, bestAskQuantity:null,
      lastTradeQty:null, lastTradeTime:null, avgPrice:null, netChange:null, percentChange:null
    };
  }

  async _openSocket() {
    if (this.ws) { try { this.ws.terminate(); } catch {} this.ws = null; }

    const { endpoint, clientId, token } = config.dhan;
    if (!endpoint || !clientId || !token) {
        throw new Error("FATAL: Dhan endpoint, clientId, and token must be configured.");
    }

    const url = `${endpoint}?version=2&authType=2&clientId=${encodeURIComponent(clientId)}&token=${encodeURIComponent(token)}`;

    console.log("[LMF] opening WS with query parameters:", url.replace(/(token=)[^&]+/, "$1<redacted>"));
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on("open", () => {
      this.reconnectAttempts = 0;
      console.log("[LMF] WS open. Sending Connect Feed (Request Code 11)...");
      
      // Send Connect Feed Request (Code 11) - Required by Dhan to initialize feed
      try {
        const connectPacket = JSON.stringify({ RequestCode: 11 });
        ws.send(connectPacket);
        console.log("[LMF] Connect Feed (11) sent successfully");
      } catch (e) {
        console.warn("[LMF] Failed to send Connect Feed:", e?.message || e);
      }
      
      // Process any pending subscriptions
      while(this.subscriptionQueue.length > 0) {
        const { list, subscriptionType } = this.subscriptionQueue.shift();
        this.sendSubscription(list, subscriptionType);
      }

      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const heartbeatPacket = Buffer.alloc(1);
          heartbeatPacket.writeUInt8(0x0F, 0);
          ws.send(heartbeatPacket);
        }
      }, 5000);
    });

    ws.on("message", (data) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (buf.length < 8) {
        if (buf.length === 1 && buf.readUInt8(0) === 15) {
          return; // Ignore heartbeats
        }
        console.warn("[LMF] Received a buffer smaller than the minimum header size.");
        return;
      }

      // Parse packet header
      const responseCode = buf.readUInt8(0);
      const exchangeSegment = buf.readUInt8(3);
      const securityId = buf.readUInt32LE(4);
      // Removed spamming log: [LMF RAW] Received Packet

      const messageLength = buf.readUInt16LE(1);

      try {
        switch (responseCode) {
          case 1: { // Index Packet
            // Removed spamming debug logs
            if (buf.length < 20) {
              console.warn(`[LMF] Received Index Packet (1) for ${securityId} with insufficient length: ${buf.length}`);
              return;
            }
            let offset = 8;
            const ltp = buf.readFloatLE(offset); offset += 4;
            const high = buf.readFloatLE(offset); offset += 4;
            const low = buf.readFloatLE(offset); offset += 4;
            const close = buf.readFloatLE(offset); offset += 4;


            const payload = { securityId: String(securityId), exchangeSegment, ltp, high, low, close };
            this.last.set(String(securityId), payload);
            this.ns.to(roomFor(securityId)).emit("index_update", payload);
            break;
          }

          case 2: { // Ticker Packet
            if (buf.length < 12) {
              console.warn(`[LMF] Received Ticker Packet (2) for ${securityId} with insufficient length: ${buf.length}`);
              return;
            }
            let offset = 8;
            const ltp = buf.readFloatLE(offset); offset += 4;

            const payload = { securityId: String(securityId), exchangeSegment, ltp };
            this.last.set(String(securityId), { ...this.last.get(String(securityId)), ...payload });
            this.ns.to(roomFor(securityId)).emit("ticker_update", payload);

            if (ltp > 0) {
                onMarketTick({ token: String(securityId), ltp: ltp });
            }

            break;
          }

          case 4: { // Quote Packet - CORRECTED IMPLEMENTATION
            if (buf.length < 50) { // 8 byte header + 42 byte payload
              console.warn(`[LMF] Received Quote Packet (4) for ${securityId} with insufficient length: ${buf.length}`);
              return;
            }
            let offset = 8;
            const ltp = buf.readFloatLE(offset); offset += 4;
            const lastTradeQty = buf.readInt16LE(offset); offset += 2;
            const lastTradeTime = new Date(buf.readInt32LE(offset) * 1000); offset += 4;
            const avgPrice = buf.readFloatLE(offset); offset += 4;
            const volume = buf.readInt32LE(offset); offset += 4;
            const totalSellQty = buf.readInt32LE(offset); offset += 4;
            const totalBuyQty = buf.readInt32LE(offset); offset += 4;
            const open = buf.readFloatLE(offset); offset += 4;
            const close = buf.readFloatLE(offset); offset += 4;
            const high = buf.readFloatLE(offset); offset += 4;
            const low = buf.readFloatLE(offset); offset += 4;

            const payload = {
              securityId: String(securityId),
              exchangeSegment,
              ltp,
              lastTradeQty,
              lastTradeTime,
              avgPrice,
              volume,
              totalSellQty,
              totalBuyQty,
              open,
              close,
              high,
              low,
            };
            
            this.last.set(String(securityId), { ...this.last.get(String(securityId)), ...payload });
            
            // Emit for both quote and index listeners, as indices use this packet.
            this.ns.to(roomFor(securityId)).emit("quote_update", payload);
            this.ns.to(roomFor(securityId)).emit("index_update", payload);

            if (ltp > 0) {
                onMarketTick({ token: String(securityId), ltp: ltp });
                // fundOnMarketTick({token : String(securityId), ltp :ltp})
            }

            break;
          }

          case 8: { // Full Packet
            if (buf.length < 162) { // 8 byte header + 54 byte main packet + 100 byte depth
                console.warn(`[LMF] Received Full Packet (8) for ${securityId} with insufficient length: ${buf.length}`);
                return;
            }
            let offset = 8;

            // --- Main Packet Parsing ---
            const ltp = buf.readFloatLE(offset); offset += 4;                     // Bytes 9-12
            const lastTradedQuantity = buf.readInt16LE(offset); offset += 2;       // Bytes 13-14
            const lastTradedTime = new Date(buf.readInt32LE(offset) * 1000); offset += 4; // Bytes 15-18
            const avgTradePrice = buf.readFloatLE(offset); offset += 4;            // Bytes 19-22
            const volume = buf.readInt32LE(offset); offset += 4;                   // Bytes 23-26
            const totalSellQuantity = buf.readInt32LE(offset); offset += 4;        // Bytes 27-30
            const totalBuyQuantity = buf.readInt32LE(offset); offset += 4;         // Bytes 31-34
            const openInterest = buf.readInt32LE(offset); offset += 4;             // Bytes 35-38
            const highestOI = buf.readInt32LE(offset); offset += 4;                // Bytes 39-42
            const lowestOI = buf.readInt32LE(offset); offset += 4;                 // Bytes 43-46            
            const openPrice = buf.readFloatLE(offset); offset += 4;                // Bytes 47-50
            const closePrice = buf.readFloatLE(offset); offset += 4;               // Bytes 51-54
            const highPrice = buf.readFloatLE(offset); offset += 4;                // Bytes 55-58
            const lowPrice = buf.readFloatLE(offset); offset += 4;                 // Bytes 59-62

            // --- Market Depth Parsing (Bytes 63-162: 5 levels × 20 bytes) ---
            const depth = { buy: [], sell: [] };
            for (let i = 0; i < 5; i++) {
                const bidQty = buf.readInt32LE(offset); offset += 4;               // Bytes 1-4
                const askQty = buf.readInt32LE(offset); offset += 4;               // Bytes 5-8
                const bidOrders = buf.readInt16LE(offset); offset += 2;            // Bytes 9-10
                const askOrders = buf.readInt16LE(offset); offset += 2;            // Bytes 11-12
                const bidPrice = buf.readFloatLE(offset); offset += 4;             // Bytes 13-16
                const askPrice = buf.readFloatLE(offset); offset += 4;             // Bytes 17-20
                
                // Only add if price is valid (> 0)
                if (bidPrice > 0) {
                  depth.buy.push({ price: bidPrice, quantity: bidQty, orders: bidOrders });
                }
                if (askPrice > 0) {
                  depth.sell.push({ price: askPrice, quantity: askQty, orders: askOrders });
                }
            }

            const payload = {
              securityId: String(securityId),
              exchangeSegment,
              ltp: ltp,
              lastTradeQty: lastTradedQuantity,
              lastTradedTime: lastTradedTime,
              avgPrice: avgTradePrice,
              volume: volume,
              totalBuyQuantity: totalBuyQuantity,
              totalSellQuantity: totalSellQuantity,
              open: openPrice,
              high: highPrice,
              low: lowPrice,
              close: closePrice,
              oi: openInterest,
              bestBidPrice: depth.buy[0]?.price || 0,
              bestBidQuantity: depth.buy[0]?.quantity || 0,
              bestAskPrice: depth.sell[0]?.price || 0,
              bestAskQuantity: depth.sell[0]?.quantity || 0,
              depth: depth
            };

            // DATA QUALITY FILTER: Skip inactive instruments with all zero values
            if (
                payload.ltp === 0 &&
                payload.lastTradeQty === 0 &&
                payload.avgPrice === 0 &&
                payload.volume === 0 &&
                payload.totalBuyQuantity === 0 &&
                payload.totalSellQuantity === 0 &&
                payload.open === 0 &&
                payload.high === 0 &&
                payload.low === 0 &&
                payload.close === 0 &&
                payload.oi === 0
            ) {
                console.log(`[LMF] Skipping market_update for inactive instrument ${securityId} (all zero values).`);
                return; // Do not broadcast or store
            }

            this.last.set(String(securityId), payload);
            this.ns.to(roomFor(securityId)).emit("market_update", payload);

            if (ltp > 0) {
                onMarketTick({ token: String(securityId), ltp: ltp });
            }
            
            break;
          }
          
          case 5: { // OI Packet
            if (buf.length < 12) { 
                console.warn(`[LMF] Received OI Packet (5) for ${securityId} with insufficient length: ${buf.length}`);
                return;
            }
            let offset = 8;
            const openInterest = buf.readInt32LE(offset); offset += 4;
            
            const payload = { securityId: String(securityId), openInterest };
            this.last.set(String(securityId), { ...this.last.get(String(securityId)), ...payload });
            this.ns.to(roomFor(securityId)).emit("oi_update", payload);
            break;
          }

          case 6: { // Prev Close Packet
            if (buf.length < 12) {
              console.warn(`[LMF] Received Prev Close Packet (6) for ${securityId} with insufficient length: ${buf.length}`);
              return;
            }
            let offset = 8;
            const prevClose = buf.readFloatLE(offset); offset += 4;

            const payload = { securityId: String(securityId), prevClose };
            this.last.set(String(securityId), { ...this.last.get(String(securityId)), ...payload });
            this.ns.to(roomFor(securityId)).emit("prev_close_update", payload);
            break;
          }

          case 7: { // Market Status Packet
            if (buf.length < 9) {
              console.warn(`[LMF] Received Market Status Packet (7) for ${securityId} with insufficient length: ${buf.length}`);
              return;
            }
            let offset = 8;
            const marketStatus = buf.readUInt8(offset); offset += 1;

            const payload = { securityId: String(securityId), marketStatus };
            this.last.set(String(securityId), { ...this.last.get(String(securityId)), ...payload });
            this.ns.to(roomFor(securityId)).emit("market_status_update", payload);
            break;
          }
          
          case 50: { // Feed Disconnect
            const disconnectCode = buf.readInt16LE(8);
            console.error(`[LMF] Received Feed Disconnect (50) from server for SecurityID ${securityId}. Code: ${disconnectCode}.`);
            break;
          }

          default:
            console.log(`[LMF] Received unhandled packet type: ${responseCode} for SecurityID ${securityId}`);
            break;
        }
      } catch (err) {
        console.error(`[LMF] Error parsing binary message (Type ${responseCode}):`, err?.message || err, "Buffer:", buf.toString('hex'));
      }
    });

    ws.on("close", (code, reason) => {
      console.warn("[LMF] WS close", code, reason);
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
      this._scheduleReconnect();
    });
    ws.on("error", (err) => {
      console.error("[LMF] ws error:", err?.message || err);
    });
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts++));
    console.log("[LMF] reconnect in", delay, "ms");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, delay);
  } }
