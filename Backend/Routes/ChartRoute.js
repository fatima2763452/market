// Routes/ChartRoute.js
const express = require("express");
const router = express.Router();
const { getChartData } = require("../Controllers/ChartController");

router.get("/getChartData", getChartData);

module.exports = router;
