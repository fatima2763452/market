// Routes/upstox.js
const express = require("express");
const router = express.Router();
const { getQuote } = require("../Controllers/quoteController");

// Example: GET /upstox/quote?symbol=NSE_EQ:INFY
router.get("/quote", getQuote);

module.exports = router;
