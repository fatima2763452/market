import mongoose from 'mongoose';
import axios from 'axios'; // Import Axios for API calls
import Order from '../../Model/OrdersModel.js';
import Fund from '../../Model/FundModel.js';
import Broker from '../../Model/BrokerModel.js'; // Assuming you store tokens here or in User

// ---------------------------------------------------------
// 1. HELPER: Fetch Live LTP (Server Side)
// ---------------------------------------------------------
async function getLiveLtp(securityId, segment, brokerId) {
    try {
  
        const brokerData = await Broker.findOne({ login_id: brokerId });
        
        if (!brokerData || !brokerData.access_token) {
            console.log('[getLiveLtp] No access token found for broker:', brokerId);
            return 0;
        }

        const token = brokerData.access_token;
        const clientId = brokerData.client_id; // If needed

        // 2. Dhan API URL (Modify if you use a different broker)
        const url = 'https://api.dhan.co/v2/marketfeed/ltp'; 
        
        // 3. Make API Call
        const response = await axios.post(
            url,
            {
                instruments: [
                    {
                        exchangeSegment: segment, // e.g., "NSE_EQ" or 1
                        securityId: securityId
                    }
                ]
            },
            {
                headers: {
                    'access-token': token,
                    'client-id': clientId,
                    'Content-Type': 'application/json'
                }
            }
        );

        // 4. Extract LTP
        // Dhan response structure: { data: { "exchangeSegment-securityId": { last_price: ... } } }
        // Adjust this parsing based on your specific Broker API response
        const data = response.data?.data;
        if (data) {
            const key = Object.keys(data)[0]; // Get the first key
            return data[key]?.last_price || 0;
        }
        
        return 0;

    } catch (err) {
        console.error('[getLiveLtp] API Error:', err.message);
        return 0; // Return 0 on failure so we can use fallback
    }
}

// ---------------------------------------------------------
// 2. HELPER: Release Funds & Calculate P&L
// ---------------------------------------------------------
const releaseFundsOnSquareoff = async (order, exitPrice) => {
    try {
        const fund = await Fund.findOne({ 
            broker_id_str: order.broker_id_str, 
            customer_id_str: order.customer_id_str 
        });

        if (!fund) return;

        // 1. Sirf Margin Calculate karo (Jo blocked tha)
        const qty = Number(order.quantity);
        const entryPrice = Number(order.price || order.average_price);
        const marginToRelease = Number(order.margin_blocked) || (entryPrice * qty);
        
        // (P&L aur Brokerage ka logic hata diya hai)

        const isIntraday = (order.product === 'MIS' || order.came_From === 'Hold' || order.order_status === 'HOLD');

        if (marginToRelease > 0) {
            if (isIntraday) {
                // 2. Used Limit kam karo
                fund.intraday.used_limit -= marginToRelease;
                if (fund.intraday.used_limit < 0) fund.intraday.used_limit = 0;
                
                // 3. Available Limit me wahi margin wapis jod do (No P&L)
                if (fund.intraday.available_limit !== undefined) {
                    fund.intraday.available_limit += marginToRelease;
                } else if (fund.intraday.free_limit !== undefined) {
                    fund.intraday.free_limit += marginToRelease;
                }
            } else {
                // Overnight Logic
                fund.overnight.available_limit += marginToRelease; // Paisa wapis
                
                if(fund.overnight.used_limit) {
                    fund.overnight.used_limit -= marginToRelease; // Blocked hataya
                    if(fund.overnight.used_limit < 0) fund.overnight.used_limit = 0;
                }
            }
            
            await fund.save();
            console.log(`[Squareoff] Funds Released (Margin Only): ${marginToRelease}`);
        }
    } catch (e) {
        console.error('[Squareoff] Fund Release Error:', e);
    }
};

// ---------------------------------------------------------
// 3. MAIN FUNCTION: placeMarketOrder
// ---------------------------------------------------------
async function placeMarketOrder(orderId) {
  if (!orderId) {
    return { ok: false, error: 'orderId is required' };
  }

  try {
    // 1. Fetch Full Order Details
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId).lean();
    }
    if (!order) {
      order = await Order.findOne({ order_id: orderId }).lean();
    }

    if (!order) {
      return { ok: false, error: 'Order not found' };
    }

    // 2. Fetch LIVE LTP from Broker API
    // (Backend fetches price because frontend is not involved in Cron)
    let currentLtp = await getLiveLtp(order.security_Id, order.segment, order.broker_id_str);

    // Fallback: If API fails (returns 0), use the last known LTP from DB to prevent 0 price exit
    if (!currentLtp || currentLtp === 0) {
        currentLtp = Number(order.ltp) || Number(order.price);
        console.log(`[placeMarketOrder] API Price fetch failed. Using stored LTP: ${currentLtp}`);
    }

    // 3. Determine 'came_From'
    const prevStatus = order.order_status || order.orderStatus || '';
    if(order.order_category === 'OVERNIGHT')prevStatus = order.order_category;
    
    let cameFrom = 'Hold';
    if (prevStatus === 'OPEN') cameFrom = 'Open';
    else if (prevStatus === 'OVERNIGHT') cameFrom = 'Overnight';
    else if (prevStatus === 'HOLD') cameFrom = 'Hold';

    // 4. Update Order in DB
    const res = await Order.updateOne(
      { _id: order._id },
      { 
          $set: { 
              order_status: 'CLOSED', 
              closed_at: new Date().toISOString(), 
              came_From: cameFrom,
              closed_ltp: Number(Number(currentLtp).toFixed(2)) // ✅ Save Live Price
          } 
      }
    );

    console.log('[placeMarketOrder] updateOne result', res);

    if (res.matchedCount > 0 || res.modifiedCount > 0) {
      console.log(`[placeMarketOrder] Order ${order._id} Closed at ₹${currentLtp}`);
      
      // 5. Release Funds Logic
      await releaseFundsOnSquareoff(order, currentLtp);

      return { 
          ok: true, 
          action: 'status_updated_to_closed', 
          orderId: String(order._id),
          price: currentLtp 
      };
    }
    return { ok: false, error: 'Update failed', details: res };

  } catch (err) {
    console.error('[placeMarketOrder] DB error:', err);
    return { ok: false, error: 'DB error', details: err.message || String(err) };
  }
}

export { placeMarketOrder };
export default placeMarketOrder;