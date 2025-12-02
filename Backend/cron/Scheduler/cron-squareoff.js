import cron from "node-cron";
import Order from "../../Model/OrdersModel.js"; 
import { isTradingDay } from "../marketCalendar.js";
import { attemptSquareoff } from "./attemptSquareoff.js";

// Helper to process list of orders
async function processCandidates(query, label) {
  try {
    const candidates = await Order.find(query).limit(1000); 
    console.log(`[cron] 🔍 ${label}: Found ${candidates.length} orders`);

    for (const orderDoc of candidates) {
      await attemptSquareoff(orderDoc);
    }
  } catch (err) {
    console.error(`[cron] Error in ${label}:`, err);
  }
}

export function stockSquareoffScheduler() {
  console.log('🚀 Stock Squareoff Scheduler Started...');

  // =========================================================
  // 1. INTRADAY SQUARE OFF (Rozana 3:15 PM - Mon-Fri)
  // =========================================================
  cron.schedule("0 15 15 * 1-5", async () => { 
      if (!isTradingDay(new Date())) {
          return console.log("[cron] Market holiday, skipping Intraday.");
      }
      
      console.log(`[cron] ⏰ Running INTRADAY Auto-Squareoff`);
      
      // Query: Category=INTRADAY AND Status is (OPEN or HOLD or NULL)
      await processCandidates(
        { 
            order_category: "INTRADAY", 
            order_status: { $in: ["OPEN", "HOLD", null] } 
        },
        "OPEN_INTRADAY"
      );
  }, { timezone: "Asia/Kolkata" });


  // =========================================================
  // 2. MIDNIGHT CLEANUP & EXPIRY CHECK (Rozana Raat 12:00 Baje)
  // =========================================================
  // Daily (*) chalega taaki Expiry Date check kar sake
  cron.schedule("0 0 0 * * *", async () => {
      console.log(`[cron] 🌙 Running Midnight Maintenance`);
      
      // A. Intraday Cleanup (Jo galti se bach gaye)
      await processCandidates(
        { 
            order_category: "INTRADAY", 
            order_status: { $in: ["HOLD"] } 
        },
        "INTRADAY_CLEANUP"
      );

      // B. OVERNIGHT / HOLD Expiry Check
      // Condition: Category=OVERNIGHT AND Status is (OPEN or HOLD or NULL)
      await processCandidates(
        { 
            order_category: "OVERNIGHT", 
            order_status: { $in: [null] } 
        },
        "OVERNIGHT_EXPIRY_CHECK"
      );

  }, { timezone: "Asia/Kolkata" });
}




