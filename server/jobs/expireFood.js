const cron = require("node-cron");
const Food = require("../models/Food"); // FIX: Use Donation model
const { getIO } = require("../socket"); // Import helper to notify frontend

const startExpireJob = () => {
  // Runs every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      const now = new Date();

      // FIX: Use 'expiryTime' to match your Donation schema
      const result = await Food.updateMany(
        {
          status: { $in: ["active", "reserved"] },
          predictedExpiry: { $lt: now }
        },
        {
          $set: { status: "expired" }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`🕒 Expired  ${result.modifiedCount} food items`);
        
        // OPTIONAL: Tell the frontend to refresh the list
        const io = getIO();
        if (io) {
          io.emit("food_expired", { count: result.modifiedCount });
        }
      }
    } catch (err) {
      console.error("❌ Expire job error:", err);
    }
  });
};

module.exports = { startExpireJob };