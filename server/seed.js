
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const crypto   = require("crypto");

const User   = require("./models/User");
const Food   = require("./models/Food");
const Rating = require("./models/Rating");

/* ============================================================
   CONFIG
============================================================ */
const FRESH_MODE = process.argv.includes("--fresh");

const CITIES = [
  { name: "Bengaluru", coords: [77.5946, 12.9716] },
  { name: "Mumbai",    coords: [72.8777, 19.0760] },
  { name: "Delhi",     coords: [77.1025, 28.7041] },
  { name: "Chennai",   coords: [80.2707, 13.0827] },
  { name: "Hyderabad", coords: [78.4867, 17.3850] },
];

// Must match Food model enums exactly
const FOOD_TYPES    = ["cooked", "raw", "packaged", "beverages", "other"];
const STORAGE_TYPES = ["room", "refrigerated"];

const RESTAURANT_NAMES = [
  "Spice Garden", "The Green Bowl", "Mumbai Tiffin", "Delhi Darbar",
  "Sunshine Cafe", "Annapurna Kitchen", "The Daily Bite", "Urban Plate",
  "Heritage Foods", "Nourish Hub",
];

const NGO_NAMES = [
  "Feed the Future",  "Hunger Zero",      "Meals for All",
  "Food Bridge",      "Nourish India",    "The Sharing Table",
  "Hope Kitchen",     "Community Plates", "Second Harvest",
  "Robin Hood Army",
];

/* ============================================================
   HELPERS
============================================================ */
const rand     = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randBool = (prob = 0.5) => Math.random() < prob;
const hoursFromNow = (h) => new Date(Date.now() + h * 3_600_000);

const jitter = ([lng, lat]) => [
  parseFloat((lng + (Math.random() - 0.5) * 0.08).toFixed(6)),
  parseFloat((lat + (Math.random() - 0.5) * 0.08).toFixed(6)),
];

const computeFreshness = (cookedTime, storageType) => {
  const ageHours = (Date.now() - new Date(cookedTime)) / 3_600_000;
  const maxHours = storageType === "refrigerated" ? 12 : 6;
  return Math.max(0, Math.round(100 - (ageHours / maxHours) * 100));
};

const computePredictedExpiry = (cookedTime, storageType) => {
  const maxHours = storageType === "refrigerated" ? 12 : 6;
  return new Date(new Date(cookedTime).getTime() + maxHours * 3_600_000);
};

/* ============================================================
   SEED USERS
============================================================ */
async function seedUsers() {
  console.log("\n  Seeding users…");
  const PASSWORD = "Password123";
  const users = { restaurants: [], ngos: [], admins: [] };

  for (let i = 0; i < RESTAURANT_NAMES.length; i++) {
    const coords = jitter(CITIES[i % CITIES.length].coords);
    const user = await User.create({
      name:     RESTAURANT_NAMES[i],
      email:    `restaurant${i + 1}@test.com`,
      password: PASSWORD,
      role:     "restaurant",
      isActive: true,
      location: { type: "Point", coordinates: coords },
    });
    users.restaurants.push(user);
    console.log(`     ✓ Restaurant: ${user.name} <${user.email}>`);
  }

  for (let i = 0; i < NGO_NAMES.length; i++) {
    const coords = jitter(CITIES[i % CITIES.length].coords);
    const user = await User.create({
      name:     NGO_NAMES[i],
      email:    `ngo${i + 1}@test.com`,
      password: PASSWORD,
      role:     "ngo",
      isActive: true,
      location: { type: "Point", coordinates: coords },
    });
    users.ngos.push(user);
    console.log(`     ✓ NGO: ${user.name} <${user.email}>`);
  }

  // Admin
  const admin = await User.create({
    name:     "System Admin",
    email:    "admin@test.com",
    password: PASSWORD,
    role:     "admin",
    isActive: true,
    location: { type: "Point", coordinates: CITIES[0].coords },
  });
  users.admins.push(admin);
  console.log(`     ✓ Admin: ${admin.name} <${admin.email}>`);

  // Deactivated user — tests the isActive login block
  await User.create({
    name:     "Deactivated User",
    email:    "deactivated@test.com",
    password: PASSWORD,
    role:     "ngo",
    isActive: false,
    location: { type: "Point", coordinates: CITIES[0].coords },
  });
  console.log("     ✓ Deactivated user: deactivated@test.com");

  // User with a live reset token — tests forgot/reset password flow
  // without needing to send a real email
  const rawToken    = "testresettokenabc123";
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  await User.create({
    name:             "Reset Test User",
    email:            "resettest@test.com",
    password: PASSWORD,
    role:             "ngo",
    isActive:         true,
    location:         { type: "Point", coordinates: CITIES[0].coords },
    resetToken:       hashedToken,
    resetTokenExpiry: Date.now() + 15 * 60 * 1000,
  });
  console.log("     ✓ Reset-token user: resettest@test.com");
  console.log("       Raw token for testing: testresettokenabc123");
  console.log("       POST /api/auth/reset-password/testresettokenabc123");

  return users;
}

/* ============================================================
   SEED FOOD
   FIX: status was "active" — corrected to "available"
   FIX: reservedBy now stores ._id not the whole doc
   FIX: spread dates across the last 14 days for chart data
============================================================ */
async function seedFood(users) {
  console.log("\n  Seeding food listings…");
  const foods = [];

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const dayMs = Date.now() - dayOffset * 24 * 3_600_000;

    for (const restaurant of users.restaurants) {
      if (!randBool(0.6)) continue; // ~60% chance of a listing on this day

      const storageType     = rand(STORAGE_TYPES);
      const cookedHoursAgo  = randInt(0, 5);
      const cookedTime      = new Date(dayMs - cookedHoursAgo * 3_600_000);
      const freshnessScore  = computeFreshness(cookedTime, storageType);
      const predictedExpiry = computePredictedExpiry(cookedTime, storageType);

      const location = {
        type:        "Point",
        coordinates: jitter(restaurant.location.coordinates),
      };

      // FIX: "available" not "active"
      const roll = Math.random();
      let status = "available";
      let reservedBy, reservedAt, deliveredAt;

      if      (roll < 0.35) { status = "available"; }
      else if (roll < 0.50) {
        status     = "reserved";
        reservedBy = rand(users.ngos)._id;  // FIX: ._id only
        reservedAt = new Date(dayMs - randInt(1, 3) * 3_600_000);
      }
      else if (roll < 0.65) {
        status     = "picked";
        reservedBy = rand(users.ngos)._id;
        reservedAt = new Date(dayMs - randInt(3, 6) * 3_600_000);
      }
      else if (roll < 0.85) {
        status      = "delivered";
        reservedBy  = rand(users.ngos)._id;
        reservedAt  = new Date(dayMs - randInt(5, 10) * 3_600_000);
        deliveredAt = new Date(dayMs - randInt(1,  4) * 3_600_000);
      }
      else { status = "expired"; }

      const food = await Food.create({
        restaurant:    restaurant._id,
        foodType:      rand(FOOD_TYPES),
        quantity:      randInt(5, 80),
        storageType,
        cookedTime,
        freshnessScore,
        predictedExpiry,
        location,
        status,
        createdAt:     new Date(dayMs - randInt(0, 2) * 3_600_000),
        ...(reservedBy  && { reservedBy }),
        ...(reservedAt  && { reservedAt }),
        ...(deliveredAt && { deliveredAt }),
      });

      foods.push(food);
    }
  }

  // Guarantee at least 5 "available" listings near Bengaluru
  // so getNearbyFood always returns results in testing
  for (let i = 0; i < 5; i++) {
    const storageType     = rand(STORAGE_TYPES);
    const cookedTime      = hoursFromNow(-randInt(0, 2));
    const predictedExpiry = computePredictedExpiry(cookedTime, storageType);
    const restaurant      = users.restaurants[i];

    const food = await Food.create({
      restaurant:    restaurant._id,
      foodType:      rand(FOOD_TYPES),
      quantity:      randInt(10, 50),
      storageType,
      cookedTime,
      freshnessScore:  computeFreshness(cookedTime, storageType),
      predictedExpiry,
      location: {
        type:        "Point",
        coordinates: jitter(CITIES[0].coords), // Bengaluru
      },
      status: "available",
    });
    foods.push(food);
  }

  const byStatus = foods.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1;
    return acc;
  }, {});

  console.log(`     Created ${foods.length} food listings:`);
  Object.entries(byStatus).forEach(([s, n]) => console.log(`       ${s}: ${n}`));
  return foods;
}

/* ============================================================
   SEED RATINGS
   FIX: restaurant lookup was .find() which returns undefined
        when the ObjectId doesn't match — now uses a Map
   FIX: only seeds ratings for delivered food with a reservedBy
============================================================ */
async function seedRatings(users, foods) {
  console.log("\n  Seeding ratings…");

  // Build a map for O(1) restaurant lookup
  const restaurantMap = {};
  users.restaurants.forEach(r => { restaurantMap[r._id.toString()] = r; });

  const delivered = foods.filter(f => f.status === "delivered" && f.reservedBy);
  let count = 0;

  for (const food of delivered) {
    if (!randBool(0.75)) continue;

    const restaurant = restaurantMap[food.restaurant.toString()];
    if (!restaurant) continue;

    try {
      await Rating.create({
        food:       food._id,
        ngo:        food.reservedBy,
        restaurant: restaurant._id,
        rating:     randInt(3, 5),
        comment: rand([
          "Very professional and timely pickup.",
          "Great coordination, will donate again.",
          "Food collected on time, great team.",
          "Smooth process, highly recommend.",
          "Quick response and good communication.",
          "Arrived exactly when they said they would.",
          "",
        ]),
        createdAt: food.deliveredAt || hoursFromNow(-randInt(1, 24)),
      });
      count++;
    } catch (err) {
      // Swallow duplicate key errors from the unique index
      if (!err.message.includes("duplicate key")) {
        console.warn(`     Rating skipped: ${err.message}`);
      }
    }
  }

  console.log(`     Created ${count} ratings`);
}

/* ============================================================
   VERIFY — query every feature and print pass/fail
============================================================ */
async function verify(users) {
  console.log("\n==========================================");
  console.log("  Feature Verification");
  console.log("==========================================");

  const checks = [];

  const check = async (label, fn) => {
    try {
      const result = await fn();
      const pass   = result !== false && result !== null && result !== undefined;
      checks.push({ label, pass });
      console.log(`  ${pass ? "✅" : "❌"} ${label}`);
    } catch (err) {
      checks.push({ label, pass: false });
      console.log(`  ❌ ${label} — ${err.message}`);
    }
  };

  // ── Users ──────────────────────────────────────────────
  await check("Restaurants seeded", async () => {
    const n = await User.countDocuments({ role: "restaurant" });
    return n >= 10;
  });

  await check("NGOs seeded", async () => {
    const n = await User.countDocuments({ role: "ngo" });
    return n >= 10;
  });

  await check("Admin seeded", async () =>
    User.findOne({ role: "admin", email: "admin@test.com" })
  );

  await check("Deactivated user exists", async () =>
    User.findOne({ email: "deactivated@test.com", isActive: false })
  );

  await check("Reset-token user exists with valid expiry", async () => {
    const u = await User.findOne({ email: "resettest@test.com" });
    return u && u.resetToken && u.resetTokenExpiry > Date.now();
  });

  // ── Food ───────────────────────────────────────────────
  await check("Available food listings exist", async () => {
    const n = await Food.countDocuments({ status: "available" });
    return n > 0;
  });

  await check("Delivered food listings exist (for analytics)", async () => {
    const n = await Food.countDocuments({ status: "delivered" });
    return n > 0;
  });

  await check("Nearby food — Bengaluru NGO can find listings", async () => {
  // $near only works with find(), not countDocuments()
  const results = await Food.find({
    status: "available",
    predictedExpiry: { $gt: new Date() },
    location: {
      $near: {
        $geometry:    { type: "Point", coordinates: CITIES[0].coords },
        $maxDistance: 10000,
      },
    },
  }).limit(1);
  return results.length > 0;
});

  await check("Food listings span last 14 days (chart data)", async () => {
    const cutoff = new Date(Date.now() - 14 * 24 * 3_600_000);
    const n = await Food.countDocuments({ createdAt: { $gte: cutoff } });
    return n >= 10;
  });

  await check("Reserved food has reservedBy field", async () => {
    const f = await Food.findOne({ status: "reserved" });
    return f && f.reservedBy != null;
  });

  await check("Delivered food has deliveredAt field", async () => {
    const f = await Food.findOne({ status: "delivered" });
    return f && f.deliveredAt != null;
  });

  // ── Ratings ────────────────────────────────────────────
  await check("Ratings seeded", async () => {
    const n = await Rating.countDocuments();
    return n > 0;
  });

  await check("NGO leaderboard has data", async () => {
    const n = await Rating.aggregate([
      { $group: { _id: "$ngo", avg: { $avg: "$rating" } } },
    ]);
    return n.length > 0;
  });

  // ── Admin Analytics ────────────────────────────────────
  await check("Admin analytics — totalListings > 0", async () => {
    const n = await Food.countDocuments();
    return n > 0;
  });

  await check("Admin analytics — deliveredCount > 0", async () => {
    const n = await Food.countDocuments({ status: "delivered" });
    return n > 0;
  });

  await check("Admin analytics — topRestaurants aggregation", async () => {
    const r = await Food.aggregate([
      { $match: { status: "delivered" } },
      { $group: { _id: "$restaurant", total: { $sum: "$quantity" } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]);
    return r.length > 0;
  });

  await check("Admin analytics — donationsPerDay has 14 days", async () => {
    const cutoff = new Date(Date.now() - 14 * 24 * 3_600_000);
    const r = await Food.aggregate([
      { $match: { createdAt: { $gte: cutoff } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, n: { $sum: 1 } } },
    ]);
    return r.length >= 5; // at least 5 distinct days
  });

  // ── Summary ────────────────────────────────────────────
  const passed = checks.filter(c => c.pass).length;
  const total  = checks.length;
  console.log("\n==========================================");
  console.log(`  ${passed}/${total} checks passed`);
  if (passed < total) {
    console.log("\n  Failed checks:");
    checks.filter(c => !c.pass).forEach(c => console.log(`    ✗ ${c.label}`));
  }
  console.log("==========================================\n");
}

/* ============================================================
   MAIN
============================================================ */
async function main() {
  console.log("\nSmart Food Redistribution — Seed Script v3");
  console.log("============================================");

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not found in .env — aborting.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  if (FRESH_MODE) {
    console.log("\n--fresh flag detected — wiping collections…");
    await Promise.all([
      User.deleteMany({}),
      Food.deleteMany({}),
      Rating.deleteMany({}),
    ]);
    console.log("Collections cleared.");
  }

  const users = await seedUsers();
  const foods = await seedFood(users);
  await seedRatings(users, foods);
  await verify(users);

  console.log("Test credentials (password: Password123)");
  console.log("─────────────────────────────────────────");
  console.log("  admin@test.com          → admin");
  console.log("  restaurant1@test.com    → restaurant (…up to 10)");
  console.log("  ngo1@test.com           → ngo        (…up to 10)");
  console.log("  deactivated@test.com    → blocked login test");
  console.log("  resettest@test.com      → reset-password test");
  console.log("  Reset token:  testresettokenabc123");
  console.log("─────────────────────────────────────────\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err); // remove .message
  mongoose.disconnect();
  process.exit(1);
});
