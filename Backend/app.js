// app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

// Routes
import authRouter from "./Routes/AuthRoute.js";
import instrumentStockNameRoute from "./Routes/instrumentStockNameRoute.js";
import optionChainRoute from "./Routes/optionChainRoute.js";
import chartRoute from "./Routes/ChartRoute.js";
import quotesRoute from "./Routes/quotes.js";
import instrumentsRoute from "./Routes/instruments.js";
import debugRoute from "./Routes/debug.js";
import userWatchlistRoute from "./Routes/UserWatchlistRoute.js";
import orderRoute from "./Routes/orderRoute.js";

export function createApp() {
  const app = express();


  // ----- CORS -----
  const origins = (config.origin || "http://localhost:5173")
    .split(",").map(s => s.trim()).filter(Boolean);

  const corsOpts = {
    origin: origins,
    credentials: true,
    methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type","Authorization"],
    optionsSuccessStatus: 204,
  };
  app.use(cors(corsOpts));

  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  // ----- Auth helpers -----
  const REQUIRE_AUTH = process.env.NODE_ENV === "production";
  const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

  function authStrict(req, res, next) {
    if (!REQUIRE_AUTH) return next();
    const bearer = req.headers.authorization || "";
    const m = bearer.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1] || req.cookies?.accessToken;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  // Quotes auth: allow if server has DHAN token, or any bearer/cookie present
  function authQuotes(req, res, next) {
    if (!REQUIRE_AUTH) return next();
    if (process.env.DHAN_ACCESS_TOKEN) return next();
    const bearer = req.headers.authorization || "";
    const m = bearer.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1] || req.cookies?.accessToken;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    return next();
  }

  // ----- Routes -----
  app.use("/api/debug", debugRoute);
  app.use("/api/auth", authStrict, authRouter);
  app.use("/api", instrumentStockNameRoute);
  app.use("/api", optionChainRoute);
  app.use("/api", chartRoute);
  app.use("/api/instruments", instrumentsRoute);
  app.use("/api/quotes", authQuotes, quotesRoute);
  app.use("/api/watchlist", userWatchlistRoute);
  app.use("/api/orders", orderRoute);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use((req, res) => res.status(404).json({ error: "Not Found" }));
  app.use((err, _req, res, _next) => {
    console.error("API Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  return app;
}
