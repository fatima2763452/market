

import placeMarketOrder from "./placeMarketOrder.js";

export async function attemptSquareoff(order) {
  if (!order) return { ok: false, reason: 'no-order' };

  // Debug: log basic order identifiers
  console.log('[attemptSquareoff] order:', { _id: order._id, order_id: order.order_id });

  const orderStatus = order.order_status || order.orderStatus;
  const orderCategory = order.order_category || order.orderCategory;
  const expireDateRaw = order.meta?.selectedStock?.expiry || order.expireDate;

  // Normalize expire date
  if (!expireDateRaw) {
    console.log('[attemptSquareoff] no expire date found for order', order._id, 'fields:', {
      meta_selectedStock_expiry: order?.meta?.selectedStock?.expiry,
      expireDate: order?.expireDate,
    });
    return { ok: false, reason: 'no-expire-date' };
  }

  const expireDate = new Date(expireDateRaw);

  // Compare expiry against today's date in India timezone (Asia/Kolkata).
  // This makes the check robust to server timezone differences.
  const expireDateStr = new Date(expireDate).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  // isExpireToday: exactly same date in IST
  const isExpireToday = expireDateStr === todayStr;
  // isExpireTodayOrPast: expiry is today or already passed (<= today) in IST
  const isExpireTodayOrPast = expireDateStr <= todayStr;

  // Optional override: force squareoff for INTRADAY orders regardless of expiry
  const FORCE_INTRADAY = process.env.SQUAREOFF_FORCE_INTRADAY === 'true';
  if (FORCE_INTRADAY) console.log('[attemptSquareoff] SQUAREOFF_FORCE_INTRADAY enabled — intraday orders will be considered expired');
  const isExpireTodayOrPastEffective = isExpireTodayOrPast || (FORCE_INTRADAY && orderCategory === 'INTRADAY');
  try {
    //open order
    // Log evaluated conditions
    console.log('[attemptSquareoff] evaluated', {
      orderStatus,
      orderCategory,
      expireDate: expireDate.toISOString(),
      expireDateStr,
      todayStr,
      isExpireToday,
      isExpireTodayOrPast,
      isExpireTodayOrPastEffective: isExpireTodayOrPastEffective,
      FORCE_INTRADAY,
    });

    // Change: allow squareoff when expiry is today OR already passed in IST
    if (orderStatus === 'OPEN' && orderCategory === 'INTRADAY' && isExpireTodayOrPastEffective) {
      console.log('[attemptSquareoff] placing market order for OPEN_INTRADAY', order._id);
      const res = await placeMarketOrder(order._id);
      return { ok: true, action: 'placed_market', result: res };
    }

    //hold order
     if (orderStatus === 'HOLD' && orderCategory === 'INTRADAY' && isExpireTodayOrPastEffective) {
      console.log('[attemptSquareoff] placing market order for HOLD_INTRADAY', order._id);
      const res = await placeMarketOrder(order._id);
      return { ok: true, action: 'placed_market', result: res };
    }

    //overnight order
     if (orderCategory === 'OVERNIGHT' && isExpireTodayOrPast) {
      console.log('[attemptSquareoff] placing market order for OVERNIGHT', order._id);
      const res = await placeMarketOrder(order._id);
      return { ok: true, action: 'placed_market', result: res };
    }

    return { ok: true, action: 'noop' };
  } catch (err) {
    console.error('[attemptSquareoff] err', err);
    return { ok: false, reason: 'error', error: err.message || err };
  }
}
