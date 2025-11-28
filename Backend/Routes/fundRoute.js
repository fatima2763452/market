import express from 'express';
import { updateNetAvailableBalance, getFunds, updateIntradayAvailabeLimit , updateOvernightAvailableLimit} from '../Controllers/fundController.js';

const router = express.Router();

router.put('/updateNetAvailableBalance', updateNetAvailableBalance);
router.get('/getFunds', getFunds);
router.put('/updateIntradayAvailableLimit', updateIntradayAvailabeLimit);
router.put('/updateOvernightAvailableLimit', updateOvernightAvailableLimit);

export default router;