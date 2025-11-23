import express from 'express';
import { getOptionChain, getExpiryList } from '../Controllers/optionChainController.js';

const router = express.Router();

// Get option chain for an underlying
router.get('/option-chain', getOptionChain);

// Get list of available expiries for an underlying
router.get('/option-chain/expiries', getExpiryList);

export default router;
