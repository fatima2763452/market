import mongoose from 'mongoose';
import Order from '../../Model/OrdersModel.js';

async function placeMarketOrder(orderId) {
  if (!orderId) {
    return { ok: false, error: 'orderId is required' };
  }

  try {
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId).select('_id').lean();
    }
    if (!order) {
      order = await Order.findOne({ order_id: orderId }).select('_id').lean();
    }

    if (!order) {
      return { ok: false, error: 'Order not found' };
    }
    const res = await Order.updateOne(
      { _id: order._id },              
      { $set: { order_status: 'CLOSED' } } 
    );

    if (res.matchedCount > 0) {
      return { ok: true, action: 'status_updated_to_closed', orderId: String(order._id) };
    }
    return { ok: false, error: 'Update failed', details: res };

  } catch (err) {
    console.error('[placeMarketOrder] DB error:', err);
    return { ok: false, error: 'DB error', details: err.message || String(err) };
  }
}

export { placeMarketOrder };
export default { placeMarketOrder };