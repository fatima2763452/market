import cron from 'node-cron';
import Fund from '../../Model/FundModel.js';

const FundCronJobs = () => {
    
    // ---------------------------------------------------------
    // Job: Reset Intraday Limits (Available & Used) to 0 at 12:00 AM
    // ---------------------------------------------------------
    cron.schedule('0 0 * * *', async () => {
        console.log('⏰ [CRON] Running Midnight Intraday Reset...');

        try {
            const result = await Fund.updateMany(
                {}, 
                { 
                    $set: { 
                        "intraday.available_limit": 0, // Available bhi 0
                        "intraday.used_limit": 0,      // Used bhi 0
                        // Result: Free Limit = 0 - 0 = 0 (Automatic)
                    } 
                }
            );

            console.log(`✅ [CRON] Success! Intraday limits set to 0 for ${result.modifiedCount} users.`);
        } catch (error) {
            console.error("❌ [CRON] Error resetting intraday limits:", error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });
};

export default FundCronJobs;