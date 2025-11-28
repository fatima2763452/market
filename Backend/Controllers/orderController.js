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
    lots,
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
  if (!product || !['MIS','NRML'].includes(String(product).trim().toUpperCase())) {
    return res.status(400).json({ error: 'product must be MIS or NRML' });
  }
  const productNorm = String(product).trim().toUpperCase();
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
    product: productNorm,
    // For MIS (intraday) we track order_status (OPEN/CLOSED/etc). For NRML (overnight) we keep order_status null
    order_status: productNorm === 'MIS' ? 'OPEN' : null,
    price: Number(price) || 0,
    quantity: qtyNum,
    lot_size: Number(lot_size) || 1,
    lots,
    // store increase_price as Number; accept decimal percentages like 0.08
    increase_price: (jobbin_price === '' || jobbin_price == null) ? 0 : Number(jobbin_price),
    meta: meta || {},
    placed_at: new Date()
  });

  const saved = await orderDoc.save();
  return res.json({ ok: true, message: 'Order saved', order: saved });
});








const getOrderInstrument = asyncHandler(async (req, res) =>{

    const source = (req.method === 'GET' && req.query && Object.keys(req.query).length) ? req.query : (req.body || {});
    const { broker_id_str, customer_id_str, orderStatus, product } = source || {};
    const order_status = (typeof orderStatus === 'string' ? orderStatus.trim().toUpperCase() : '');
    const productIn = (typeof product === 'string' ? product.trim().toUpperCase() : '');

    const filter = {};
    if (broker_id_str) filter.broker_id_str = String(broker_id_str);
    if (customer_id_str) filter.customer_id_str = String(customer_id_str);

    // If caller requested a specific product (MIS or NRML), apply filter
    if (productIn && ['MIS','NRML'].includes(productIn)) {
        filter.product = productIn;
    }

    // Default behavior: if caller doesn't specify orderStatus, return only OPEN orders
    // BUT when caller asked for NRML/overnight (`product=NRML`), do NOT filter by order_status (NRML orders keep order_status null).
    if (String(productIn).toUpperCase() === 'NRML') {
        // 🎯 FIX: For NRML, filter out explicitly CLOSED orders, keeping only active/null status.
        filter.order_status = { $ne: 'CLOSED' };
        
    } else {
        if (order_status) {
          // allow special value 'ALL' to bypass filtering
          if (String(order_status).toUpperCase() !== 'ALL') {
            filter.order_status = String(order_status);
          }
        } else {
          filter.order_status = 'OPEN';
        }
    }

    try {
        const ordersInstrument = await Order.find(filter).lean();
        return res.json({ ok: true, ordersInstrument });
    } catch (err) {
        console.error("getOrderInstrument error:", err);
        return res.status(500).json({ ok: false, error: "Failed to fetch orders" });
    }
})








const updateOrder = asyncHandler(async (req, res) => {
  const {
    broker_id_str,
    customer_id_str,
    order_id, 
    security_Id,
    symbol,
    side,
    product,
    quantity,
    lots,    
    price, // Price will be used as closed_ltp if order_status is CLOSED
    order_status,
    segment,
    closed_ltp,
    closed_at,
    came_From,
    ...rest
  } = req.body || {};

  
  if (!order_id) {
    return res.status(400).json({ success: false, message: 'order_id is required' });
  }

  
  const update = {};
  if (broker_id_str !== undefined) update.broker_id_str = String(broker_id_str).trim();
  if (customer_id_str !== undefined) update.customer_id_str = String(customer_id_str).trim();
  if (security_Id !== undefined) update.security_Id = String(security_Id).trim();
  if (symbol !== undefined) update.symbol = String(symbol).trim();
  if (side !== undefined) update.side = String(side).trim().toUpperCase();
  if (product !== undefined) update.product = String(product).trim();
  if (product !== undefined) {
    const prodNorm = String(product).trim().toUpperCase();
    if (!['MIS','NRML'].includes(prodNorm)) {
      return res.status(400).json({ success: false, message: 'product must be MIS or NRML' });
    }
    update.product = prodNorm;
  }
    if(came_From !== undefined) update.came_From = String(came_From).trim();
  
  // === START: Order Status and Closure Logic ===
  if (order_status !== undefined) {
    const statusNorm = String(order_status).trim().toUpperCase();
    update.order_status = statusNorm;

    if (statusNorm === 'CLOSED') {
        const closePrice = (price !== undefined && price !== null && price !== '') ? Number(price) : (
            (closed_ltp !== undefined && closed_ltp !== null && closed_ltp !== '') ? Number(closed_ltp) : NaN
        );

        if (Number.isNaN(closePrice) || closePrice < 0) {
            return res.status(400).json({ success: false, message: 'Closing price must be a valid non-negative number when status is CLOSED' });
        }
        
        // 🎯 Use the provided 'price' from the request body as the closed_ltp
        update.closed_ltp = closePrice; 
        
        // Always set closed_at when status is CLOSED
        update.closed_at = new Date(); 
    } else {
        // If status is not CLOSED (e.g., OPEN, HOLD), clear closed fields
        update.closed_ltp = null;
        update.closed_at = null;
    }
}
  // === END: Order Status and Closure Logic ===

  if (quantity !== undefined && quantity !== null && quantity !== '') {
    const q = Number(quantity);
    if (Number.isNaN(q) || q < 0) {
      return res.status(400).json({ success: false, message: 'quantity must be a valid non-negative number' });
    }
    update.quantity = q;
  }

  if (lots !== undefined && lots !== null && lots !== '') {
    const l = Number(lots);
    if (Number.isNaN(l) || l < 0) {
      return res.status(400).json({ success: false, message: 'lots must be a valid non-negative number' });
    }
    update.lots = l;
  }

  if (price !== undefined && price !== null && price !== '') {
    const p = Number(price);
    if (Number.isNaN(p) || p < 0) {
      return res.status(400).json({ success: false, message: 'price must be a valid non-negative number' });
    }
    // If not a closure action, update price field for open orders/holdings
    if (update.order_status !== 'CLOSED') {
      update.price = p;
    }
  }

  // metadata
  update.updatedAt = new Date();

  try {
   
    const query = {};
    query.order_id = order_id;

    if (broker_id_str !== undefined && broker_id_str !== null && broker_id_str !== '') {
      query.broker_id_str = String(broker_id_str);
    }
    if (customer_id_str !== undefined && customer_id_str !== null && customer_id_str !== '') {
      query.customer_id_str = String(customer_id_str);
    }
    if (security_Id !== undefined && security_Id !== null && security_Id !== '') {
      query.security_Id = String(security_Id);
    }
    if (segment !== undefined && segment !== null && segment !== '') {
      query.segment = String(segment);
    }

    // Try find by the assembled query
    let existing = await Order.findOne(query);


    if (!existing) {
      try {
        const byId = await Order.findById(order_id);
        if (byId) {
          existing = byId;
        }
      } catch (err) {
     
      }
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // If the effective product for this order is NRML (either existing or being updated), ensure order_status is cleared 
    // unless it's explicitly being CLOSED
    const effectiveProduct = (update.product) ? String(update.product).trim().toUpperCase() : (existing.product ? String(existing.product).trim().toUpperCase() : null);
    
    if (effectiveProduct === 'NRML' && update.order_status !== 'CLOSED') {
      update.order_status = null;
    } else if (effectiveProduct === 'MIS' && update.order_status === undefined) {
        // Ensure MIS orders default to OPEN/HOLD if status isn't explicitly provided but product is MIS
        update.order_status = existing.order_status || 'OPEN';
    }


    // Perform update using existing._id to be precise
    const updated = await Order.findByIdAndUpdate(existing._id, { $set: update }, { new: true, runValidators: true });

    if (!updated) {
      return res.status(500).json({ success: false, message: 'Failed to update order' });
    }

    return res.status(200).json({ success: true, message: 'Order updated', order: updated });

  } catch (err) {
    console.error('[updateOrder] unexpected error:', err.stack || err);
    // Return a non-sensitive error message
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});




// NOTE: Frontend se ab hum 'PUT' request bhejenge
const exitAllOpenOrder = asyncHandler(async (req, res) => {
    // URL params se IDs
    const { broker_id_str, customer_id_str } = req.query;
    
    // Body se Payload
    const { closed_ltp_map, closed_at } = req.body || {}; 

    if (!broker_id_str || !customer_id_str) {
        res.status(400);
        throw new Error("Missing Broker ID or Customer ID");
    }

    // --- FIX 1: Database Field Names Sahi Kiye ---
    // Screenshot ke hisab se fields 'broker_id_str' aur 'customer_id_str' hain
    const openOrders = await Order.find({
        broker_id_str: broker_id_str,      // <--- Was 'broker_id' (Wrong)
        customer_id_str: customer_id_str,  // <--- Was 'customer_id' (Wrong)
        order_status: "OPEN", 
        order_category: "INTRADAY"
    });  

    // Agar koi order nahi mila
    if (!openOrders || openOrders.length === 0) {
        // Debugging ke liye log kar sakte hain
        console.log("No orders found for:", broker_id_str, customer_id_str);
        return res.status(200).json({ 
            success: false, 
            message: "No open Intraday orders found to exit." 
        });
    }

    const results = [];

    // 2. Loop and Update
    for (const order of openOrders) {
        try {
            const exitPrice = closed_ltp_map ? closed_ltp_map[order._id] : 0;
            
            order.order_status = "CLOSED"; 
            order.closed_at = closed_at || new Date(); 
            
            // Price update logic
            if (exitPrice) {
                order.closed_ltp = exitPrice; 
                // Profit/Loss calculation logic bhi yaha add kar sakte ho future me
            }

            await order.save();
            
            results.push({ id: order._id, status: "Success", exit_price: exitPrice });
        } catch (error) {
            console.error(`Failed to exit order ${order._id}:`, error);
            results.push({ id: order._id, status: "Failed", error: error.message });
        }
    }

    res.status(200).json({
        success: true,
        message: `Successfully exited ${results.length} orders`,
        details: results
    });
});


export { getOrderInstrument,postOrder,updateOrder, exitAllOpenOrder };