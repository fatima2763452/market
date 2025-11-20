import asyncHandler from 'express-async-handler';
import Order from '../Model/OrdersModel.js';

const postOrder = asyncHandler(async (req, res) => {
	const body = req.body || {};

	const {
		broker_id_str,
		customer_id_str,
		security_Id,
		symbol,
		side,
		product,
		price = 0,
		quantity,
		lot_size = 1,
		segment = 'UNKNOWN',
		jobbin_price,
		meta = {}
	} = body;

	if (!broker_id_str || !customer_id_str) {
		return res.status(400).json({ error: 'broker_id_str and customer_id_str are required' });
	}
	if (!security_Id || !symbol) {
		return res.status(400).json({ error: 'security_Id and symbol are required' });
	}
	if (!side || !['BUY','SELL'].includes(side)) {
		return res.status(400).json({ error: 'side must be BUY or SELL' });
	}
	if (!product || !['MIS','NRML'].includes(product)) {
		return res.status(400).json({ error: 'product must be MIS or NRML' });
	}
	const qtyNum = Number(quantity);
	if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
		return res.status(400).json({ error: 'quantity must be a positive number' });
	}

	if(!jobbin_price){
		return res.status(400).json({ error: 'enter jobbing price' });

	}

	console.log(jobbin_price)

	const orderDoc = new Order({
		broker_id_str: String(broker_id_str),
		customer_id_str: String(customer_id_str),
		security_Id: String(security_Id),
		symbol: String(symbol),
		segment: String(segment),
		side,
		product,
		price: Number(price) || 0,
		quantity: qtyNum,
		lot_size: Number(lot_size) || 1,
		// store increase_price as Number; accept decimal percentages like 0.08
		increase_price: (jobbin_price === '' || jobbin_price == null) ? 0 : Number(jobbin_price),
		meta: meta || {},
		placed_at: new Date()
	});

	const saved = await orderDoc.save();
	return res.json({ ok: true, message: 'Order saved', order: saved });
});



const getOrderInstrument = asyncHandler(async (req, res) =>{
	const {broker_id_str, customer_id_str , side} = req.body || {};

	const filter = {};
	if (broker_id_str) filter.broker_id_str = String(broker_id_str);
	if (customer_id_str) filter.customer_id_str = String(customer_id_str);
	if (side) filter.side = String(side).toUpperCase(); // keep stored value format consistent
	console.log("api touch")
	try {
		const ordersInstrument = await Order.find(filter).lean();
		return res.json({ ok: true, ordersInstrument });
	} catch (err) {
		console.error("getOrderInstrument error:", err);
		return res.status(500).json({ ok: false, error: "Failed to fetch orders" });
	}
})

export { getOrderInstrument,postOrder };