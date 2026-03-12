const cron = require("node-cron");
const Food = require("../models/Food");

const startExpireJob = () => {
  // runs every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      const now = new Date();

      const result = await Food.updateMany(
        {
          status: "available",
          expiresAt: { $lt: now }
        },
        {
          status: "expired"
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`Expired ${result.modifiedCount} food donations`);
      }

    } catch (err) {
      console.error("Expire job error:", err);
    }
  });
};

module.exports = { startExpireJob };