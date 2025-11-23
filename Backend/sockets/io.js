// sockets/io.js
import { Server } from "socket.io";
import { config } from "../config.js";

let ioInstance = null;
let feedSubscriber = null;

export function setFeedSubscriber(fn) { feedSubscriber = fn; }

export function getIO() {
  if (!ioInstance) {
    throw new Error("Socket.IO has not been initialized!");
  }
  return ioInstance;
}

export function createIO(server) {
  // --- CORS SETUP (UPDATED) ---
  const defaultOrigins = [
    "https://app.wolfkrypt.me", // Allow your public frontend
    "http://localhost:5173",    // Allow local frontend
    "http://127.0.0.1:5173"     // Allow local IP
  ];

  const configOrigins = (config.origin || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  // Merge default and config origins
  const allOrigins = [...defaultOrigins, ...configOrigins];

  const io = new Server(server, {
    path: "/socket.io",
    cors: { 
        origin: allOrigins, 
        credentials: true, 
        methods: ["GET", "POST", "OPTIONS"] 
    },
    transports: ["websocket", "polling"],
  });
  // ---------------------------

  ioInstance = io;

  const market = io.of("/market");

  market.on("connection", (socket) => {
    console.log("📡 Market client connected:", socket.id);

    socket.on("subscribe", (list, subscriptionType = 'full') => {

      if (feedSubscriber) feedSubscriber(list, subscriptionType);
      for (const it of list || []) {
        const room = `sec:${String(it.securityId)}`;
        socket.join(room);
      }
    });

    socket.on("unsubscribe", (list) => {
      for (const it of list || []) {
        const room = `sec:${String(it.securityId)}`;
        socket.leave(room);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ socket disconnected:", socket.id, reason);
    });
  });

  return { io, market };
}