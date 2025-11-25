
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

    // Delete the document
    const res = await Order.deleteOne({ _id: order._id });
    if (res.deletedCount && res.deletedCount > 0) {
      return { ok: true, action: 'deleted', orderId: String(order._id) };
    }

    // fallback: nothing deleted
    return { ok: false, error: 'Delete failed', details: res };
  } catch (err) {
    console.error('[placeMarketOrder] DB error:', err);
    return { ok: false, error: 'DB error', details: err.message || String(err) };
  }
}

export { placeMarketOrder };
export default { placeMarketOrder };
