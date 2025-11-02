const express = require("express");
const router = express.Router();
const { getOptionChain } = require("../Controllers/optionChainController");

router.get("/option-chain", getOptionChain);

module.exports = router;
