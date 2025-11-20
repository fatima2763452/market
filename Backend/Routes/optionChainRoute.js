import express from 'express';
import { getOptionChain } from '../Controllers/optionChainController.js';

const router = express.Router();
router.get('/option-chain', getOptionChain);

export default router;
