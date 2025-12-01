import placeMarketOrder from "./placeMarketOrder.js";

export async function attemptSquareoff(order) {
  if (!order) return { ok: false, reason: 'no-order' };

  const orderStatus = order.order_status || order.orderStatus; // Can be 'OPEN', 'HOLD', or null/undefined
  const orderCategory = order.order_category || order.orderCategory;
  
  // Expiry Date nikaalo
  const expireDateRaw = order.meta?.selectedStock?.expiry || order.expireDate;
  
  // Date Comparison ke liye strings (YYYY-MM-DD) - Asia/Kolkata timezone zaroori hai
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  
  let expireDateStr = null;
  if (expireDateRaw) {
      expireDateStr = new Date(expireDateRaw).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  }

  // --- HELPER: CHECK IF STATUS IS ACTIVE (OPEN, HOLD, or NULL) ---
  // Agar status null/undefined hai to bhi hum use 'Active' maan rahe hain check karne ke liye
  const isActiveStatus = (status) => {
      return status === 'OPEN' || status === 'HOLD' || status === null || status === undefined;
  };

  // --- LOGIC START ---

  try {
    // ===============================================
    // CASE 1: INTRADAY (Hamesha Close hoga)
    // ===============================================
    if (orderCategory === 'INTRADAY' && isActiveStatus(orderStatus)) {
        console.log(`✅ [Squareoff] Closing Intraday: ${order._id} (Status: ${orderStatus})`);
        const res = await placeMarketOrder(order._id);
        return { ok: true, action: 'closed_intraday', result: res };
    }

    // ===============================================
    // CASE 2: OVERNIGHT / HOLD (Sirf Expiry Date par close hoga)
    // ===============================================
    if (orderCategory === 'OVERNIGHT' && isActiveStatus(orderStatus)) {
        
        // Agar expiry date hi nahi hai, to skip karo (Safety)
        if (!expireDateStr) {
            // console.log(`ℹ️ [Squareoff] Skipped Overnight (No Expiry Date): ${order._id}`);
            return { ok: false, reason: 'no_expiry_date_found' };
        }

        // AGAR (Expiry Date <= Aaj) -> TO CLOSE KARO
        // Yani agar Expiry Aaj hai ya Nikal chuki hai
        if (expireDateStr <= todayStr) {
            console.log(`✅ [Squareoff] Closing EXPIRED Overnight: ${order._id} (Status: ${orderStatus}, Exp: ${expireDateStr})`);
            const res = await placeMarketOrder(order._id);
            return { ok: true, action: 'closed_expired_overnight', result: res };
        } 
        
        // AGAR (Expiry Date > Aaj) -> KUCH MAT KARO
        // Yani Expiry Future me hai
        else {
            // console.log(`🛡️ [Squareoff] Keeping Active: ${order._id} (Exp: ${expireDateStr} is Future)`);
            return { ok: true, action: 'kept_active_future_expiry' };
        }
    }

    return { ok: true, action: 'noop' };

  } catch (err) {
    console.error('[attemptSquareoff] Error:', err.message);
    return { ok: false, reason: 'error', error: err.message };
  }
}