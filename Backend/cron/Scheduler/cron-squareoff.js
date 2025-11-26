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
  cron.schedule(
    "0 14 15 * * 1-5",
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
}
