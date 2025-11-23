import express from 'express';
import { postOrder, getOrderInstrument, updateOrder } from '../Controllers/orderController.js';

const router = express.Router();

router.post('/postOrder', postOrder);
router.get('/getOrderInstrument', getOrderInstrument);
router.post('/updateOrder', updateOrder);

export default router;