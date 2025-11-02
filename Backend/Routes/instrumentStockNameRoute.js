
const express = require('express');
const router = express.Router();
const {getStockName} = require('../Controllers/instrumentStockNameControllers');


// ✅ Properly bind controller to route
router.get('/instrumentGetName', getStockName);

module.exports = router;
