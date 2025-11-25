
import { placeMarketOrder } from './orderPlacement.js';


export async function attemptSquareoff(order) {
  if (!order) return { ok: false, reason: 'no-order' };

  const orderStatus = order.order_status || order.orderStatus;
  const orderCategory = order.order_category || order.orderCategory;
  const expireDateRaw = order.meta?.selectedStock?.expiry || order.expireDate;

  // Normalize expire date
  if (!expireDateRaw) return { ok: false, reason: 'no-expire-date' };

  const expireDate = new Date(expireDateRaw);
  const today = new Date();
  const isExpireToday = expireDate.getFullYear() === today.getFullYear() &&
                        expireDate.getMonth() === today.getMonth() &&
                        expireDate.getDate() === today.getDate();

  try {
    //open order
    if (orderStatus === 'OPEN' && orderCategory === 'INTRADAY' && isExpireToday) {
      const res = await placeMarketOrder(order._id);
      return { ok: true, action: 'placed_market', result: res };
    }

    //hold order
     if (orderStatus === 'HOLD' && orderCategory === 'INTRADAY' && isExpireToday) {
      const res = await placeMarketOrder(order._id);
      return { ok: true, action: 'placed_market', result: res };
    }

    //overnight order
     if (orderCategory === 'OVERNIGHT' && isExpireToday) {
      const res = await placeMarketOrder(order._id);
      return { ok: true, action: 'placed_market', result: res };
    }

    return { ok: true, action: 'noop' };
  } catch (err) {
    console.error('[attemptSquareoff] err', err);
    return { ok: false, reason: 'error', error: err.message || err };
  }
}
