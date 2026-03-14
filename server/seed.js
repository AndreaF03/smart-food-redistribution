/**
 * Smart Food Redistribution — MongoDB Seed Script (v2 — schema-corrected)
 * -------------------------------------------------------------------------
 * Place this file at:  server/seed.js
 *
 * Run with:
 *   cd server
 *   node seed.js          <- adds data, keeps existing records
 *   node seed.js --fresh  <- wipes ALL collections first, then seeds
 *
 * Fixes from v1:
 *   - foodType enum:    "cooked"|"raw"|"packaged"|"beverages"|"other"
 *   - storageType enum: "room"|"refrigerated"  (not "frozen")
 *   - status enum:      "active" (not "available")
 *   - predictedExpiry:  now included (required field, was missing)
 *   - location on Food: now included (required field, was missing)
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const User     = require("./models/User");
const Food     = require("./models/Food");
const Donation = require("./models/Donation");
const Rating   = require("./models/Rating");

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

// FIXED: exact enum values from your Food model
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

const rand    = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randBool = (prob = 0.5) => Math.random() < prob;

const hoursFromNow = (h) => new Date(Date.now() + h * 3_600_000);

const jitter = ([lng, lat]) => [
  parseFloat((lng + (Math.random() - 0.5) * 0.08).toFixed(6)),
  parseFloat((lat + (Math.random() - 0.5) * 0.08).toFixed(6)),
];

const computeFreshness = (cookedTime) => {
  const ageHours = (Date.now() - new Date(cookedTime)) / 3_600_000;
  return Math.max(0, Math.round(100 - ageHours * 10));
};

// FIXED: predictedExpiry derived from cookedTime + storageType
const computePredictedExpiry = (cookedTime, storageType) => {
  const shelfHours = storageType === "refrigerated" ? 48 : 6;
  return new Date(new Date(cookedTime).getTime() + shelfHours * 3_600_000);
};

/* ============================================================
   SEED USERS
============================================================ */

async function seedUsers() {
  console.log("\n  Seeding users...");
  const password = await bcrypt.hash("Password123", 10);
  const users = { restaurants: [], ngos: [], admins: [] };

  for (let i = 0; i < RESTAURANT_NAMES.length; i++) {
    const coords = jitter(CITIES[i % CITIES.length].coords);
    const user = await User.create({
      name:     RESTAURANT_NAMES[i],
      email:    `restaurant${i + 1}@test.com`,
      password,
      role:     "restaurant",
      location: { type: "Point", coordinates: coords },
    });
    users.restaurants.push(user);
    console.log(`     Restaurant: ${user.name} (${user.email})`);
  }

  for (let i = 0; i < NGO_NAMES.length; i++) {
    const coords = jitter(CITIES[i % CITIES.length].coords);
    const user = await User.create({
      name:     NGO_NAMES[i],
      email:    `ngo${i + 1}@test.com`,
      password,
      role:     "ngo",
      location: { type: "Point", coordinates: coords },
    });
    users.ngos.push(user);
    console.log(`     NGO: ${user.name} (${user.email})`);
  }

  const admin = await User.create({
    name:     "System Admin",
    email:    "admin@test.com",
    password,
    role:     "admin",
    location: { type: "Point", coordinates: CITIES[0].coords },
  });
  users.admins.push(admin);
  console.log(`     Admin: ${admin.name} (${admin.email})`);

  return users;
}

/* ============================================================
   SEED FOOD
============================================================ */

async function seedFood(users) {
  console.log("\n  Seeding food listings...");
  const foods = [];

  for (const restaurant of users.restaurants) {
    const count = randInt(3, 6);

    for (let i = 0; i < count; i++) {
      const storageType    = rand(STORAGE_TYPES);           // "room" or "refrigerated"
      const cookedHoursAgo = randInt(0, 8);
      const cookedTime     = hoursFromNow(-cookedHoursAgo); // always in the past
      const freshnessScore = computeFreshness(cookedTime);
      const predictedExpiry = computePredictedExpiry(cookedTime, storageType); // FIXED: required

      // FIXED: Food model requires its own location field (not just restaurant ref)
      const location = {
        type:        "Point",
        coordinates: jitter(restaurant.location.coordinates),
        address:     `Near ${restaurant.name}`,
      };

      // FIXED: status enum uses "active" not "available"
      const roll = Math.random();
      let status = "active";
      let reservedBy, reservedAt, deliveredAt;

      if      (roll < 0.40) { status = "active"; }
      else if (roll < 0.60) { status = "reserved";  reservedBy = rand(users.ngos)._id; reservedAt = hoursFromNow(-randInt(1, 4)); }
      else if (roll < 0.75) { status = "picked";    reservedBy = rand(users.ngos)._id; reservedAt = hoursFromNow(-randInt(3, 6)); }
      else if (roll < 0.90) { status = "delivered"; reservedBy = rand(users.ngos)._id; reservedAt = hoursFromNow(-randInt(5, 10)); deliveredAt = hoursFromNow(-randInt(1, 4)); }
      else                  { status = "expired"; }

      const food = await Food.create({
        restaurant:    restaurant._id,
        foodType:      rand(FOOD_TYPES),     // "cooked"|"raw"|"packaged"|"beverages"|"other"
        quantity:      randInt(5, 80),
        storageType,                          // "room"|"refrigerated"
        cookedTime,
        freshnessScore,
        predictedExpiry,                      // FIXED: was missing, is required
        location,                             // FIXED: was missing, is required
        status,
        ...(reservedBy  && { reservedBy }),
        ...(reservedAt  && { reservedAt }),
        ...(deliveredAt && { deliveredAt }),
      });

      foods.push(food);
    }
  }

  console.log(`     Created ${foods.length} food listings`);
  return foods;
}

/* ============================================================
   SEED DONATIONS
============================================================ */

async function seedDonations(users) {
  console.log("\n  Seeding donations...");

  const PICKUP_LOCATIONS = [
    "Ground floor, main entrance",
    "Kitchen exit, back of building",
    "Reception area, lobby",
    "Loading bay, side entrance",
    "Restaurant counter, ask for manager",
  ];

  const FOOD_NAMES = [
    "Rice batch", "Roti bundle", "Curry pot", "Dal serving",
    "Soup batch", "Bread loaves", "Biryani tray", "Khichdi pot"
  ];

  // Build all docs first, then insert in one shot with insertMany
  // This bypasses the pre-save hook entirely — safe for seed data
  const docs = [];
  const now  = new Date();

  for (const restaurant of users.restaurants) {
    const n = randInt(2, 4);
    for (let i = 0; i < n; i++) {
      const expiryTime = hoursFromNow(randInt(4, 48));
      const roll = Math.random();
      let status = "available", claimedBy;

      if      (roll < 0.45) { status = "available"; }
      else if (roll < 0.65) { status = "reserved";  claimedBy = rand(users.ngos)._id; }
      else if (roll < 0.80) { status = "picked";    claimedBy = rand(users.ngos)._id; }
      else if (roll < 0.92) { status = "delivered"; claimedBy = rand(users.ngos)._id; }
      else                  { status = "expired"; }

      const doc = {
        restaurant:     restaurant._id,
        foodName:       rand(FOOD_NAMES),
        quantity:       randInt(5, 60),
        pickupLocation: rand(PICKUP_LOCATIONS),
        expiryTime,
        status,
        createdAt:      now,
        updatedAt:      now,
      };
      if (claimedBy) doc.claimedBy = claimedBy;
      docs.push(doc);
    }
  }

  // insertMany with ordered:false skips pre-save hooks and is much faster
  const result = await Donation.insertMany(docs, { ordered: false });
  console.log(`     Created ${result.length} donations`);
}

/* ============================================================
   SEED RATINGS
============================================================ */

async function seedRatings(users, foods) {
  console.log("\n  Seeding ratings...");

  const delivered = foods.filter(f => f.status === "delivered" && f.reservedBy);
  let count = 0;

  for (const food of delivered) {
    if (!randBool(0.7)) continue;

    const restaurant = users.restaurants.find(
      r => r._id.toString() === food.restaurant.toString()
    );
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
          "Food was collected on time.",
          "Smooth process, highly recommend.",
          "Quick response and good communication.",
          "Arrived exactly when they said they would.",
          "",
          "",
        ]),
      });
      count++;
    } catch (err) {
      console.warn(`     Rating skipped: ${err.message}`);
    }
  }

  console.log(`     Created ${count} ratings`);
}

/* ============================================================
   MAIN
============================================================ */

async function main() {
  console.log("Smart Food Redistribution - Seed Script v2");
  console.log("==========================================");

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not found in .env - aborting.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  if (FRESH_MODE) {
    console.log("\n--fresh flag detected - wiping all collections...");
    await Promise.all([
      User.deleteMany({}),
      Food.deleteMany({}),
      Donation.deleteMany({}),
      Rating.deleteMany({}),
    ]);
    console.log("Collections cleared.");
  }

  const users = await seedUsers();
  const foods = await seedFood(users);
  await seedDonations(users);
  await seedRatings(users, foods);

  console.log("\n==========================================");
  console.log("Seeding complete!\n");
  console.log("Test credentials (all passwords: Password123)");
  console.log("-----------------------------------------");
  console.log("  Admin      -> admin@test.com");
  console.log("  Restaurant -> restaurant1@test.com ... restaurant10@test.com");
  console.log("  NGO        -> ngo1@test.com        ... ngo10@test.com");
  console.log("-----------------------------------------\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  mongoose.disconnect();
  process.exit(1);
});