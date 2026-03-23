/**
 * FoodBridge — End-to-End API Test Suite
 * ────────────────────────────────────────
 * Place at: server/e2e.test.js
 *
 * Install deps (once):
 *   npm install axios
 *
 * Run:
 *   node e2e.test.js
 *
 * Requires server running on localhost:5000
 * Requires seed data: node seed.js --fresh
 */

const axios = require("axios");

const BASE = "http://localhost:5000/api";

/* ============================================================
   TEST RUNNER
============================================================ */
let passed = 0;
let failed = 0;
const failures = [];

async function test(label, fn) {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (err) {
    const msg = err.response
      ? `HTTP ${err.response.status} — ${JSON.stringify(err.response.data)}`
      : err.message;
    console.log(`  ❌ ${label}\n     ${msg}`);
    failed++;
    failures.push({ label, msg });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function section(title) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(50));
}

/* ============================================================
   SHARED STATE  (populated as tests run)
============================================================ */
const state = {
  // tokens
  restaurantToken: null,
  ngoToken: null,
  adminToken: null,

  // user ids
  restaurantId: null,
  ngoId: null,

  // food ids
  availableFoodId: null,
  reservedFoodId: null,
  pickedFoodId: null,
  deliveredFoodId: null,
  createdFoodId: null,
};

/* ============================================================
   HELPERS
============================================================ */
const api = (token) =>
  axios.create({
    baseURL: BASE,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    validateStatus: () => true, // never throw on HTTP errors
  });

const post = (url, data, token) => api(token).post(url, data);
const get = (url, token) => api(token).get(url);
const patch = (url, data, token) => api(token).patch(url, data);
const del = (url, token) => api(token).delete(url);
const put = (url, data, token) => api(token).put(url, data);

/* ============================================================
   1. AUTH
============================================================ */
async function testAuth() {
  section("1. Authentication");
  let freshResetToken;
  // ── Register ──
  await test("POST /auth/register — missing fields returns 400", async () => {
    const r = await post("/auth/register", { email: "x@x.com" });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test("POST /auth/register — short password returns 400", async () => {
    const r = await post("/auth/register", {
      name: "Test",
      email: "shortpw@test.com",
      password: "123",
      location: { type: "Point", coordinates: [77.5, 12.9] },
    });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test("POST /auth/register — duplicate email returns 400", async () => {
    const r = await post("/auth/register", {
      name: "Dup",
      email: "restaurant1@test.com",
      password: "Password123",
      location: { type: "Point", coordinates: [77.5, 12.9] },
    });
    assert(r.status === 400);
  });

  // ── Login ──
  await test("POST /auth/login — wrong password returns 401", async () => {
    const r = await post("/auth/login", {
      email: "restaurant1@test.com",
      password: "wrongpassword",
    });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test("POST /auth/login — deactivated user returns 403", async () => {
    const r = await post("/auth/login", {
      email: "deactivated@test.com",
      password: "Password123",
    });
    assert(r.status === 403, `Expected 403, got ${r.status}`);
  });

  await test("POST /auth/login — restaurant login succeeds", async () => {
    const r = await post("/auth/login", {
      email: "restaurant1@test.com",
      password: "Password123",
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.data.token, "No token in response");
    assert(
      r.data.role === "restaurant",
      `Expected role=restaurant, got ${r.data.role}`,
    );
    state.restaurantToken = r.data.token;
    state.restaurantId = r.data.user._id;
  });

  await test("POST /auth/login — NGO login succeeds", async () => {
    const r = await post("/auth/login", {
      email: "ngo1@test.com",
      password: "Password123",
    });
    assert(r.status === 200);
    state.ngoToken = r.data.token;
    state.ngoId = r.data.user._id;
  });

  await test("POST /auth/login — admin login succeeds", async () => {
    const r = await post("/auth/login", {
      email: "admin@test.com",
      password: "Password123",
    });
    assert(r.status === 200);
    state.adminToken = r.data.token;
  });

  // ── Protected routes ──
  await test("GET /auth/me — no token returns 401", async () => {
    const r = await get("/auth/me");
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test("GET /auth/me — valid token returns user", async () => {
    const r = await get("/auth/me", state.restaurantToken);
    assert(r.status === 200);
    assert(r.data.email === "restaurant1@test.com");
  });

  // ── Update profile ──
  await test("PUT /auth/me — update name succeeds", async () => {
    const r = await put(
      "/auth/me",
      { name: "Spice Garden Updated" },
      state.restaurantToken,
    );
    assert(r.status === 200);
    assert(r.data.user.name === "Spice Garden Updated");
  });

  await test("PUT /auth/me — duplicate email returns 400", async () => {
    const r = await put(
      "/auth/me",
      { email: "restaurant2@test.com" },
      state.restaurantToken,
    );
    assert(r.status === 400);
  });

  // ── Forgot / Reset password ──
  await test("POST /auth/forgot-password — unknown email still returns 200", async () => {
    const r = await post("/auth/forgot-password", { email: "nobody@test.com" });
    assert(r.status === 200);
  });

  await test("POST /auth/forgot-password — known email returns 200", async () => {
    const r = await post("/auth/forgot-password", {
      email: "resettest@test.com",
    });
    assert(r.status === 200);
    freshResetToken = r.data._resetToken; // capture it
  });

  await test("POST /auth/reset-password/:token — invalid token returns 400", async () => {
    const r = await post("/auth/reset-password/invalidtoken999", {
      password: "NewPass123",
    });
    assert(r.status === 400);
  });

  await test("POST /auth/reset-password/:token — valid token resets password", async () => {
    const tokenToUse = freshResetToken || "testresettokenabc123";
    const r = await post(`/auth/reset-password/${tokenToUse}`, {
      password: "NewPassword123",
    });
    assert(
      r.status === 200,
      `Expected 200, got ${r.status} — ${JSON.stringify(r.data)}`,
    );
  });

  await test("POST /auth/login — login with new password after reset", async () => {
    const r = await post("/auth/login", {
      email: "resettest@test.com",
      password: "NewPassword123",
    });
    assert(r.status === 200);
  });
}

/* ============================================================
   2. FOOD — CREATE
============================================================ */
async function testFoodCreate() {
  section("2. Food — Create");

  await test("POST /food — no token returns 401", async () => {
    const r = await post("/food", { foodType: "cooked", quantity: 10 });
    assert(r.status === 401);
  });

  await test("POST /food — NGO cannot create food (403)", async () => {
    const r = await post(
      "/food",
      {
        foodType: "cooked",
        quantity: 10,
        cookedTime: new Date(Date.now() - 3600000).toISOString(),
        storageType: "room",
      },
      state.ngoToken,
    );
    assert(r.status === 403);
  });

  await test("POST /food — missing fields returns 400", async () => {
    const r = await post(
      "/food",
      { foodType: "cooked" },
      state.restaurantToken,
    );
    assert(r.status === 400);
  });

  await test("POST /food — future cookedTime returns 500", async () => {
    const r = await post(
      "/food",
      {
        foodType: "cooked",
        quantity: 20,
        cookedTime: new Date(Date.now() + 3600000).toISOString(),
        storageType: "room",
      },
      state.restaurantToken,
    );
    assert(r.status === 500);
  });

  await test("POST /food — valid data creates listing", async () => {
    const r = await post(
      "/food",
      {
        foodType: "cooked",
        quantity: 30,
        cookedTime: new Date(Date.now() - 3600000).toISOString(),
        storageType: "room",
      },
      state.restaurantToken,
    );
    assert(
      r.status === 201,
      `Expected 201, got ${r.status} — ${JSON.stringify(r.data)}`,
    );
    assert(r.data._id, "No _id in response");
    assert(r.data.freshnessScore >= 0, "No freshnessScore");
    assert(r.data.predictedExpiry, "No predictedExpiry");
    state.createdFoodId = r.data._id;
  });
}

/* ============================================================
   3. FOOD — DASHBOARDS & NEARBY
============================================================ */
async function testFoodRead() {
  section("3. Food — Dashboards & Nearby");

  await test("GET /food/nearby — restaurant cannot access (403)", async () => {
    const r = await get("/food/nearby", state.restaurantToken);
    assert(r.status === 403);
  });

  await test("GET /food/nearby — NGO gets nearby food", async () => {
    const r = await get("/food/nearby", state.ngoToken);
    assert(r.status === 200);
    assert(Array.isArray(r.data));
    // Store an available food id for reservation test
    const available = r.data.find((f) => f.status === "available");
    if (available) state.availableFoodId = available._id;
  });

  await test("GET /food/restaurant/dashboard — returns food array", async () => {
    const r = await get("/food/restaurant/dashboard", state.restaurantToken);
    assert(r.status === 200);
    assert(Array.isArray(r.data));
    // Find a reserved item for pick test
    const reserved = r.data.find((f) => f.status === "reserved");
    if (reserved) state.reservedFoodId = reserved._id;
    // Find delivered item for rating test
    const delivered = r.data.find((f) => f.status === "delivered");
    if (delivered) state.deliveredFoodId = delivered._id;
  });

  await test("GET /food/ngo/dashboard — returns reserved/picked/delivered", async () => {
    const r = await get("/food/ngo/dashboard", state.ngoToken);
    assert(r.status === 200);
    assert(r.data.reserved !== undefined);
    assert(r.data.picked !== undefined);
    assert(r.data.delivered !== undefined);
    // Find picked item for deliver test
    const picked = r.data.picked[0];
    if (picked) state.pickedFoodId = picked._id;
  });

  await test("GET /food/admin/analytics — non-admin returns 403", async () => {
    const r = await get("/food/admin/analytics", state.restaurantToken);
    assert(r.status === 403);
  });

  await test("GET /food/admin/analytics — admin gets full analytics", async () => {
    const r = await get("/food/admin/analytics", state.adminToken);
    assert(r.status === 200);
    assert(typeof r.data.totalListings === "number", "Missing totalListings");
    assert(typeof r.data.deliveredCount === "number", "Missing deliveredCount");
    assert(typeof r.data.activeCount === "number", "Missing activeCount");
    assert(typeof r.data.reservedCount === "number", "Missing reservedCount");
    assert(typeof r.data.expiredCount === "number", "Missing expiredCount");
    assert(
      typeof r.data.totalQuantityRedistributed === "number",
      "Missing totalQuantityRedistributed",
    );
    assert(Array.isArray(r.data.topRestaurants), "Missing topRestaurants");
    assert(Array.isArray(r.data.ngoActivity), "Missing ngoActivity");
    assert(Array.isArray(r.data.donationsPerDay), "Missing donationsPerDay");
  });
}

/* ============================================================
   4. FOOD — EDIT & DELETE
============================================================ */
async function testFoodMutate() {
  section("4. Food — Edit & Delete");

  await test("PATCH /:id — NGO cannot edit (403)", async () => {
    const r = await patch(
      `/food/${state.createdFoodId}`,
      { quantity: 5 },
      state.ngoToken,
    );
    assert(r.status === 403);
  });

  await test("PATCH /:id — owner can edit quantity", async () => {
    const r = await patch(
      `/food/${state.createdFoodId}`,
      { quantity: 25 },
      state.restaurantToken,
    );
    assert(r.status === 200);
    assert(r.data.food.quantity === 25);
  });

  await test("PATCH /:id — edit recalculates freshnessScore", async () => {
    const r = await patch(
      `/food/${state.createdFoodId}`,
      {
        cookedTime: new Date(Date.now() - 1800000).toISOString(),
        storageType: "refrigerated",
      },
      state.restaurantToken,
    );
    assert(r.status === 200);
    assert(r.data.food.freshnessScore >= 0);
    assert(r.data.food.predictedExpiry);
  });

  await test("DELETE /:id — NGO cannot delete (403)", async () => {
    const r = await del(`/food/${state.createdFoodId}`, state.ngoToken);
    assert(r.status === 403);
  });

  await test("DELETE /:id — owner can delete available listing", async () => {
    const r = await del(`/food/${state.createdFoodId}`, state.restaurantToken);
    assert(r.status === 200);
  });

  await test("DELETE /:id — already deleted returns 404", async () => {
    const r = await del(`/food/${state.createdFoodId}`, state.restaurantToken);
    assert(r.status === 404);
  });
}

/* ============================================================
   5. FOOD — RESERVE / PICK / DELIVER FLOW
============================================================ */
async function testFoodFlow() {
  section("5. Food — Reserve → Pick → Deliver Flow");

  // Create a fresh food item for this flow so we control its state
  let flowFoodId;

  await test("Setup — create fresh food listing for flow test", async () => {
    const r = await post(
      "/food",
      {
        foodType: "packaged",
        quantity: 15,
        cookedTime: new Date(Date.now() - 1800000).toISOString(),
        storageType: "refrigerated",
      },
      state.restaurantToken,
    );
    assert(r.status === 201);
    flowFoodId = r.data._id;
  });

  await test("PATCH /reserve/:id — restaurant cannot reserve (403)", async () => {
    const r = await patch(
      `/food/reserve/${flowFoodId}`,
      {},
      state.restaurantToken,
    );
    assert(r.status === 403);
  });

  await test("PATCH /reserve/:id — NGO reserves food", async () => {
    const r = await patch(`/food/reserve/${flowFoodId}`, {}, state.ngoToken);
    assert(
      r.status === 200,
      `Expected 200, got ${r.status} — ${JSON.stringify(r.data)}`,
    );
    assert(r.data.food.status === "reserved");
  });

  await test("PATCH /reserve/:id — cannot reserve already-reserved food", async () => {
    const r = await patch(`/food/reserve/${flowFoodId}`, {}, state.ngoToken);
    assert(r.status === 400);
  });

  await test("PATCH /pick/:id — NGO cannot confirm pickup (403)", async () => {
    const r = await patch(`/food/pick/${flowFoodId}`, {}, state.ngoToken);
    assert(r.status === 403);
  });

  await test("PATCH /pick/:id — restaurant confirms pickup", async () => {
    const r = await patch(
      `/food/pick/${flowFoodId}`,
      {},
      state.restaurantToken,
    );
    assert(
      r.status === 200,
      `Expected 200, got ${r.status} — ${JSON.stringify(r.data)}`,
    );
    assert(r.data.food.status === "picked");
  });

  await test("PATCH /deliver/:id — restaurant cannot mark delivered (403)", async () => {
    const r = await patch(
      `/food/deliver/${flowFoodId}`,
      {},
      state.restaurantToken,
    );
    assert(r.status === 403);
  });

  await test("PATCH /deliver/:id — NGO marks delivered", async () => {
    const r = await patch(`/food/deliver/${flowFoodId}`, {}, state.ngoToken);
    assert(
      r.status === 200,
      `Expected 200, got ${r.status} — ${JSON.stringify(r.data)}`,
    );
    assert(r.data.food.status === "delivered");
    assert(r.data.food.deliveredAt, "No deliveredAt timestamp");
    // Use this for rating test
    state.flowFoodId = flowFoodId;
  });

  await test("DELETE /:id — cannot delete delivered food (400)", async () => {
    const r = await del(`/food/${flowFoodId}`, state.restaurantToken);
    assert(r.status === 400);
  });
}

/* ============================================================
   6. RATINGS
============================================================ */
async function testRatings() {
  section("6. Ratings");

  await test("POST /ratings — NGO cannot submit rating (403)", async () => {
    const r = await post(
      "/ratings",
      {
        foodId: state.flowFoodId,
        rating: 4,
      },
      state.ngoToken,
    );
    assert(r.status === 403);
  });

  await test("POST /ratings — rating out of range returns 400", async () => {
    const r = await post(
      "/ratings",
      {
        foodId: state.flowFoodId,
        rating: 6,
      },
      state.restaurantToken,
    );
    assert(r.status === 400);
  });

  await test("POST /ratings — valid rating submitted", async () => {
    const r = await post(
      "/ratings",
      {
        foodId: state.flowFoodId,
        rating: 5,
        comment: "Excellent NGO, highly recommend.",
      },
      state.restaurantToken,
    );
    assert(
      r.status === 201,
      `Expected 201, got ${r.status} — ${JSON.stringify(r.data)}`,
    );
    assert(r.data.rating._id, "No rating _id");
    state.ratingId = r.data.rating._id;
  });

  await test("POST /ratings — duplicate rating returns 400", async () => {
    const r = await post(
      "/ratings",
      {
        foodId: state.flowFoodId,
        rating: 3,
      },
      state.restaurantToken,
    );
    assert(r.status === 400);
  });

  await test("GET /ratings/my — returns rated food ids", async () => {
    const r = await get("/ratings/my", state.restaurantToken);
    assert(r.status === 200);
    assert(Array.isArray(r.data.ratedFoodIds));
    assert(r.data.ratedFoodIds.includes(state.flowFoodId.toString()));
  });

  await test("GET /ratings/leaderboard — non-admin returns 403", async () => {
    const r = await get("/ratings/leaderboard", state.restaurantToken);
    assert(r.status === 403);
  });

  await test("GET /ratings/leaderboard — admin gets leaderboard", async () => {
    const r = await get("/ratings/leaderboard", state.adminToken);
    assert(r.status === 200);
    assert(Array.isArray(r.data));
    assert(r.data.length > 0, "Leaderboard is empty");
    const entry = r.data[0];
    assert(entry.ngoName !== undefined, "Missing ngoName");
    assert(entry.avgRating !== undefined, "Missing avgRating");
    assert(entry.totalDeliveries !== undefined, "Missing totalDeliveries");
  });

  await test("DELETE /ratings/:id — delete within 24h succeeds", async () => {
    const r = await del(`/ratings/${state.ratingId}`, state.restaurantToken);
    assert(r.status === 200);
  });
}

/* ============================================================
   7. ADMIN USER MANAGEMENT
============================================================ */
async function testAdminUsers() {
  section("7. Admin — User Management");

  await test("GET /auth/users — non-admin returns 403", async () => {
    const r = await get("/auth/users", state.restaurantToken);
    assert(r.status === 403);
  });

  await test("GET /auth/users — admin gets all users", async () => {
    const r = await get("/auth/users", state.adminToken);
    assert(r.status === 200);
    assert(Array.isArray(r.data));
    assert(r.data.length >= 23, `Expected ≥23 users, got ${r.data.length}`);
    // No passwords in response
    assert(r.data[0].password === undefined, "Password leaked in response");
  });

  await test("PATCH /auth/users/:id/role — invalid role returns 400", async () => {
    const r = await patch(
      `/auth/users/${state.ngoId}/role`,
      { role: "superadmin" },
      state.adminToken,
    );
    assert(r.status === 400);
  });

  await test("PATCH /auth/users/:id/role — admin can change role", async () => {
    const r = await patch(
      `/auth/users/${state.ngoId}/role`,
      { role: "restaurant" },
      state.adminToken,
    );
    assert(r.status === 200);
    assert(r.data.user.role === "restaurant");
    // Restore role
    await patch(
      `/auth/users/${state.ngoId}/role`,
      { role: "ngo" },
      state.adminToken,
    );
  });

  await test("PATCH /auth/users/:id/deactivate — admin can deactivate user", async () => {
    const r = await patch(
      `/auth/users/${state.ngoId}/deactivate`,
      {},
      state.adminToken,
    );
    assert(r.status === 200);
    // Restore — reactivate manually for any further tests
  });

  await test("PATCH /auth/users/:id/deactivate — cannot deactivate self", async () => {
    // Get admin's own id
    const me = await get("/auth/me", state.adminToken);
    const adminId = me.data._id;
    const r = await patch(
      `/auth/users/${adminId}/deactivate`,
      {},
      state.adminToken,
    );
    assert(r.status === 400);
  });
}

/* ============================================================
   8. RATE LIMITING (smoke test)
============================================================ */
async function testRateLimiting() {
  section("8. Rate Limiting — Smoke Test");

  await test("POST /auth/login — 10 rapid requests, 11th blocked (429)", async () => {
    const requests = Array.from({ length: 11 }, () =>
      post("/auth/login", { email: "nobody@x.com", password: "wrong" }),
    );
    const results = await Promise.all(requests);
    const blocked = results.some((r) => r.status === 429);
    assert(blocked, "Rate limiter did not trigger after 10 requests");
  });
}

/* ============================================================
   MAIN
============================================================ */
async function main() {
  console.log("\nFoodBridge — End-to-End API Test Suite");
  console.log("========================================");
  console.log(`  Target: ${BASE}`);
  console.log("  Run: node seed.js --fresh first\n");

  // Verify server is up
  try {
    await axios.get(`${BASE}/auth/me`, { validateStatus: () => true });
  } catch {
    console.error("  ❌ Cannot reach server at", BASE);
    console.error("  Start your server first: node server.js\n");
    process.exit(1);
  }

  await testAuth();
  await testFoodCreate();
  await testFoodRead();
  await testFoodMutate();
  await testFoodFlow();
  await testRatings();
  await testAdminUsers();
  await testRateLimiting();

  // ── Summary ──
  const total = passed + failed;
  console.log(`\n${"═".repeat(50)}`);
  console.log(`  Results: ${passed}/${total} passed`);

  if (failures.length > 0) {
    console.log("\n  Failed tests:");
    failures.forEach((f) => {
      console.log(`    ✗ ${f.label}`);
      console.log(`      ${f.msg}`);
    });
  } else {
    console.log("  All tests passed 🎉");
  }
  console.log(`${"═".repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner crashed:", err.message);
  process.exit(1);
});
