import express from 'express';
import { postOrder, getOrderInstrument, updateOrder, exitAllOpenOrder } from '../Controllers/orderController.js';

const router = express.Router();

router.post('/postOrder', postOrder);
router.get('/getOrderInstrument', getOrderInstrument);
router.post('/updateOrder', updateOrder);
router.put('/exitAllOpenOrder', exitAllOpenOrder);

export default router;