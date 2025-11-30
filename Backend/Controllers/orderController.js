import asyncHandler from 'express-async-handler';
import Order from '../Model/OrdersModel.js';
import Fund from '../Model/FundModel.js';

import { lmf as dhanSocket } from '../index.js'; // Rename karke use karo taaki code change na karna pade
import { addToWatchlist, updateTriggerInWatchlist } from '../Utils/OrderManager.js'; 

const postOrder = asyncHandler(async (req, res) => {
  const body = req.body || {};

  // ... (Apki purani destructuring aur validations same rahengi) ...
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

  if (!broker_id_str || !customer_id_str) return res.status(400).json({ error: 'broker_id_str and customer_id_str are required' });
  if (!security_Id || !symbol) return res.status(400).json({ error: 'security_Id and symbol are required' });
  if (!side || !['BUY','SELL'].includes(side)) return res.status(400).json({ error: 'side must be BUY or SELL' });
  if (!product || !['MIS','NRML'].includes(String(product).trim().toUpperCase())) return res.status(400).json({ error: 'product must be MIS or NRML' });
  
  const productNorm = String(product).trim().toUpperCase();
  const qtyNum = Number(quantity);
  
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) return res.status(400).json({ error: 'quantity must be a positive number' });
  if (!jobbin_price) return res.status(400).json({ error: 'enter jobbing price' });

  // ============================================================
  // START: FUND & MARGIN LOGIC (Same as updateOrder)
  // ============================================================

  const requiredMargin = Number(price) * qtyNum;

  const fund = await Fund.findOne({ broker_id_str, customer_id_str });

  if (!fund) {
    return res.status(404).json({ error: "Fund account not found for this user." });
  }

  const isIntraday = productNorm === 'MIS';
  let availableLimit = 0;
  
  if (isIntraday) {
    // Intraday: Free = Available - Used
    availableLimit = fund.intraday.available_limit - fund.intraday.used_limit;
  } else {
    // Overnight: Direct Available Limit (Cash)
    availableLimit = fund.overnight.available_limit;
  }

  if (requiredMargin > availableLimit) {
    return res.status(400).json({ 
      error: `Insufficient Funds! Required: ${requiredMargin.toFixed(2)}, Available: ${availableLimit.toFixed(2)}` 
    });
  }

  // *** DEDUCT FUNDS ***
  if (isIntraday) {
    // Intraday: Increase Used Limit
    fund.intraday.used_limit += requiredMargin;
  } else {
    // Overnight: Decrease Available Limit (Direct Cut)
    fund.overnight.available_limit -= requiredMargin;
  }

  await fund.save(); 
  // ============================================================
  // END: FUND LOGIC
  // ============================================================

  // ... (Create Order Object - Same as before) ...
  const orderDoc = new Order({
    broker_id_str: String(broker_id_str),
    customer_id_str: String(customer_id_str),
    security_Id: String(security_Id),
    symbol: String(symbol),
    segment: String(segment),
    side,
    product: productNorm,
    order_status: productNorm === 'MIS' ? 'OPEN' : null,
    price: Number(price) || 0,
    quantity: qtyNum,
    lot_size: Number(lot_size) || 1,
    lots,
    increase_price: (jobbin_price === '' || jobbin_price == null) ? 0 : Number(jobbin_price),
    margin_blocked: requiredMargin, // Save blocked margin
    meta: meta || {},
    placed_at: new Date()
  });

  try {
    const saved = await orderDoc.save();
    
    // Add to RAM (For Auto-Exit)
    addToWatchlist(saved);
    dhanSocket.subscribe([{ segment: saved.segment, securityId: saved.security_Id }]);

    return res.json({ ok: true, message: 'Order saved', order: saved });
  } catch (error) {
    // --- ROLLBACK FUND (Refund if Fail) ---
    if (isIntraday) {
      fund.intraday.used_limit -= requiredMargin;
    } else {
      fund.overnight.available_limit += requiredMargin;
    }
    await fund.save();
    
    return res.status(500).json({ error: 'Order creation failed: ' + error.message });
  }
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
    price, 
    order_status,
    segment,
    closed_ltp,
    closed_at,

    came_From, 
    stop_loss,
    target,
    ...rest
  } = req.body || {};

  if (!order_id) {
    return res.status(400).json({ success: false, message: 'order_id is required' });
  }

  // Update Object Creation
  const update = {};
  
  if (quantity) update.quantity = Number(quantity);
  if (lots) update.lots = Number(lots);
  if (price && order_status !== 'CLOSED') update.price = Number(price);
  if (order_status) update.order_status = order_status;
  if (closed_ltp) update.closed_ltp = Number(closed_ltp);
  if (closed_at) update.closed_at = closed_at;
  
  // 👇 Fix: Add came_From to update object
  if (came_From) update.came_From = String(came_From).trim();

  // 👇 SL/Target update
  if (stop_loss !== undefined) update.stop_loss = Number(stop_loss);
  if (target !== undefined) update.target = Number(target);

  update.updatedAt = new Date();

  try {
    // 1. Find Existing Order
    let existing = await Order.findOne({ order_id: order_id });
    if (!existing) existing = await Order.findById(order_id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // 2. Find Fund
    const fund = await Fund.findOne({ 
        broker_id_str: existing.broker_id_str, 
        customer_id_str: existing.customer_id_str 
    });

    if (!fund) {
        return res.status(404).json({ success: false, message: "Fund account not found" });
    }

    // Determine Product Type & Fund Source
    const currentProduct = update.product || existing.product; 
    const currentStatus = update.order_status || existing.order_status;
    const isHold = currentStatus === 'HOLD';
    const isIntraday = String(currentProduct).trim().toUpperCase() === 'MIS' || isHold; 

    // ============================================================
    // START: FUND UPDATE LOGIC
    // ============================================================

    // --- SCENARIO 1: BUY MORE (Quantity Increase) ---
    // 🛑 BUG FIXED HERE: Removed comma operator. Use checks for NOT closed.
    // Covers: OPEN (Intraday), HOLD (Holdings), and null (Overnight)
    if (update.quantity && update.quantity > existing.quantity && existing.order_status !== 'CLOSED') {
        
        const newQty = Number(update.quantity);
        const calcPrice = update.price ? Number(update.price) : Number(existing.price);
        
        const oldMargin = existing.margin_blocked || (existing.quantity * existing.price);
        const newTotalMargin = newQty * calcPrice;
        
        const marginToDeduct = newTotalMargin - oldMargin;

        if (marginToDeduct > 0) {
            // Check Available Funds
            let availableLimit = 0;
            let currentUsed = 0; 

            if (isIntraday) {
                // Intraday Logic (Free = Available - Used)
                availableLimit = fund.intraday.available_limit;
                currentUsed = fund.intraday.used_limit;
            } else {
                // Overnight Logic (Direct Cash)
                availableLimit = fund.overnight.available_limit;
                currentUsed = 0;
            }

            const freeLimit = availableLimit - currentUsed;

            if (marginToDeduct > freeLimit) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Insufficient Funds! Required: ${marginToDeduct.toFixed(2)}, Available: ${freeLimit.toFixed(2)}` 
                });
            }

            // *** UPDATE FUND ***
            if (isIntraday) {
                // Intraday/HOLD: Increase Used Limit
                fund.intraday.used_limit += marginToDeduct;
            } else {
                // Overnight (NRML): Decrease Available Limit
                fund.overnight.available_limit -= marginToDeduct;
            }
            
            // Record new total margin
            update.margin_blocked = newTotalMargin;
        }
    } 
    
    // --- SCENARIO 2: EXIT / CLOSE ORDER (Refund) ---
    else if (update.order_status === 'CLOSED' && existing.order_status !== 'CLOSED') {
        
        const marginToRelease = existing.margin_blocked || (existing.price * existing.quantity);

        if (marginToRelease > 0) {
            if (isIntraday) {
                fund.intraday.used_limit -= marginToRelease;
                if (fund.intraday.used_limit < 0) fund.intraday.used_limit = 0;
            } else {
                fund.overnight.available_limit += marginToRelease;
            }
        }
    }

    await fund.save();

    // ============================================================
    // DB UPDATE & MEMORY UPDATE
    // ============================================================

    const updated = await Order.findByIdAndUpdate(existing._id, { $set: update }, { new: true, runValidators: true });

    if (!updated) {
      return res.status(500).json({ success: false, message: 'Failed to update order' });
    }

    // 👇 Update Watchlist (Auto-Exit System)
    if (updated.order_status !== 'CLOSED') {
        updateTriggerInWatchlist(updated);
    }

    return res.status(200).json({ success: true, message: 'Order updated', order: updated });

  } catch (err) {
    console.error('[updateOrder] error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
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