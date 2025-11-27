import cron from "node-cron";
import Order from "../../Model/OrdersModel.js";
import { isTradingDay } from "../marketCalendar.js";
import { attemptSquareoff } from "./attemptSquareoff.js";

async function processCandidates(query, label) {
  const candidates = await Order.find(query).limit(200).lean();
  console.log(`[cron] Found ${candidates.length} candidate ${label} orders`);

  for (const cand of candidates) {
    const orderDoc = await Order.findById(cand._id);
    if (!orderDoc) continue;

    const result = await attemptSquareoff(orderDoc);
    console.log(
      `[cron] ${label} - ${orderDoc.order_id || orderDoc._id} ->`,
      result
    );
  }
}

export function stockSquareoffScheduler() {
  // open order cron (15:14 IST Mon-Fri)
  console.log('[cron] Registering schedule: OPEN_INTRADAY ->', "0 58 17 * * 1-5", 'tz=Asia/Kolkata');
  cron.schedule(
    "0 28 19 * * 1-5",
    async () => {
      try {
        if (!isTradingDay(new Date())) {
          console.log("[cron] Not a trading day, skipping");
          return;
        }
        console.log(
          `[cron] Running intraday open-candidates ${new Date().toLocaleString(
            "en-IN"
          )}`
        );
        await processCandidates(
          { order_category: "INTRADAY", order_status: "OPEN" },
          "OPEN_INTRADAY"
        );
      } catch (err) {
        console.error("[cron] error:", err.stack || err);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  // HOLD orders
  console.log('[cron] Registering schedule: HOLD_INTRADAY ->', "0 0 0 * * 1-5", 'tz=Asia/Kolkata');
  cron.schedule(
    "0 0 0 * * 1-5",
    async () => {
      try {
        if (!isTradingDay(new Date())) return;
        console.log(
          `[cron] Running midnight HOLD candidates ${new Date().toLocaleString(
            "en-IN"
          )}`
        );
        await processCandidates(
          { order_category: "INTRADAY", order_status: "HOLD" },
          "HOLD_INTRADAY"
        );
      } catch (err) {
        console.error(err);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  // overnight
  console.log('[cron] Registering schedule: OVERNIGHT ->', "0 0 0 * * 1-5", 'tz=Asia/Kolkata');
  cron.schedule(
    "0 0 0 * * 1-5",
    async () => {
      try {
        if (!isTradingDay(new Date())) return;
        console.log(
          `[cron] Running midnight OVERNIGHT candidates ${new Date().toLocaleString(
            "en-IN"
          )}`
        );
        await processCandidates({ order_category: "OVERNIGHT" }, "OVERNIGHT");
      } catch (err) {
        console.error(err);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  // Optional debug schedule: enable by setting CRON_DEBUG=true in env (runs every 10s)
  if (process.env.CRON_DEBUG === 'true') {
    console.log('[cron] CRON_DEBUG enabled — registering debug schedule (every 10s)');
    cron.schedule('*/10 * * * * *', async () => {
      try {
        console.log('[cron][debug] heartbeat', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
      } catch (e) {
        console.error('[cron][debug] error', e);
      }
    });
  }
}