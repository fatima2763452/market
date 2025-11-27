import mongoose from 'mongoose';
import Order from '../../Model/OrdersModel.js';

async function placeMarketOrder(orderId) {
  if (!orderId) {
    return { ok: false, error: 'orderId is required' };
  }

  try {
    // Find the order and include its status so we can record where it came from
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId).select('_id order_status orderStatus').lean();
    }
    if (!order) {
      order = await Order.findOne({ order_id: orderId }).select('_id order_status orderStatus').lean();
    }

    if (!order) {
      return { ok: false, error: 'Order not found' };
    }
    // Map order status to came_From enum values (Open, Overnight, Hold)
    const prevStatus = order.order_status || order.orderStatus || '';
    let cameFrom = 'Hold'; // default
    if (prevStatus === 'OPEN') cameFrom = 'Open';
    else if (prevStatus === 'OVERNIGHT') cameFrom = 'Overnight';
    else if (prevStatus === 'HOLD') cameFrom = 'Hold';

    const res = await Order.updateOne(
      { _id: order._id },
      { $set: { order_status: 'CLOSED', closed_at: new Date().toISOString(), came_From: cameFrom } }
    );

    console.log('[placeMarketOrder] updateOne result for', String(order._id), res);
    if (res.matchedCount > 0 || res.modifiedCount > 0) {
      console.log('[placeMarketOrder] order closed', String(order._id));
      return { ok: true, action: 'status_updated_to_closed', orderId: String(order._id) };
    }
    return { ok: false, error: 'Update failed', details: res };

  } catch (err) {
    console.error('[placeMarketOrder] DB error:', err);
    return { ok: false, error: 'DB error', details: err.message || String(err) };
  }
}

export { placeMarketOrder };
export default placeMarketOrder;