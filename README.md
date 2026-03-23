# 🍱 FoodBridge — Smart Food Redistribution Platform

> A full-stack MERN application that connects restaurants with surplus food to nearby NGOs, reducing food waste through intelligent matching, freshness scoring, and real-time coordination.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Food Lifecycle](#-food-lifecycle)
- [Freshness Scoring](#-freshness-scoring)
- [Real-Time Notifications](#-real-time-notifications)
- [Map View](#-map-view)
- [Security](#-security)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Roles & Permissions](#-roles--permissions)
- [Testing](#-testing)
- [Project Structure](#-project-structure)
- [Future Improvements](#-future-improvements)
- [Author](#-author)

---

## 🌍 Overview

FoodBridge tackles food waste at the source — restaurants, cafes, and cloud kitchens that produce surplus food daily. Instead of discarding it, restaurants post listings that nearby NGOs can browse on a **live interactive map**, reserve, and collect. The platform manages the full lifecycle from listing to delivery, with automated freshness tracking, geospatial matching, real-time Socket.io notifications, and an admin analytics dashboard.

**Problem:** An estimated 40% of food produced in India is wasted, while 200 million people remain food insecure.

**Solution:** A real-time coordination layer between food donors and distributors, with intelligent freshness scoring to ensure only safe food is redistributed.

---

## ✨ Features

### 🍽️ For Restaurants
- Post surplus food listings with food type, quantity, storage type, and cooked time
- Upload food images via **Cloudinary**
- Automatic **freshness score** and **predicted expiry** calculation on every listing
- Dashboard to track all listings and their current status
- Confirm NGO pickup with one click
- Rate NGOs (1–5 stars + comment) after successful delivery
- **Real-time notifications** when NGOs reserve or deliver food

### 🤝 For NGOs
- Browse nearby available food on an **interactive Leaflet map**
- Switch between **Map View** and **List View**
- 10 km radius geospatial search with green markers for available food
- Reserve listings directly from map popups
- Personal dashboard showing reserved, picked, and delivered history
- **Real-time notifications** at every status change

### 📊 For Admins
- Full user management — view all users, change roles, deactivate accounts
- Analytics dashboard powered by **Recharts**:
  - Total listings, delivered count, active, reserved, and expired counts
  - Total quantity redistributed
  - Donations per day (14-day trend chart)
  - Top donating restaurants
  - NGO activity breakdown
- NGO leaderboard with average ratings and delivery counts

### 🔧 Platform-Wide
- JWT-based authentication with role-based access control
- Password reset via email (SHA-256 hashed token, expires in 15 min)
- Rate limiting on auth endpoints (brute-force protection after 10 requests)
- Automatic expiry via **node-cron** — stale listings marked `expired` on schedule
- Helmet security headers, XSS sanitization, MongoDB injection protection

---

## 🛠 Tech Stack

### Frontend

| Library | Purpose |
|---------|---------|
| React 18 | UI framework |
| React Router | Client-side routing |
| Axios | HTTP requests |
| Socket.io Client | Real-time events |
| React Leaflet | Interactive map |
| Recharts | Analytics charts |

### Backend

| Library | Purpose |
|---------|---------|
| Node.js + Express | REST API server |
| MongoDB + Mongoose | Database + ODM |
| JWT + bcryptjs | Auth + password hashing |
| Socket.io | Real-time notifications |
| node-cron | Scheduled expiry job |
| Cloudinary + Multer | Image uploads |
| Nodemailer | Password reset emails |
| Helmet | Security headers |
| express-rate-limit | Brute-force protection |

---

## 🏗 System Architecture

```
smart-food-redistribution/
├── client/                  ← React SPA
│   └── src/
│       ├── api/             ← Axios service layer
│       ├── components/      ← Reusable UI components
│       └── pages/           ← Role-specific views
└── server/                  ← Express REST API
    ├── controllers/         ← Business logic
    ├── models/              ← Mongoose schemas
    ├── routes/              ← Express routers
    ├── middleware/          ← Auth, role guards
    ├── jobs/                ← Cron job (expireFood.js)
    ├── utils/               ← Mailer, helpers
    ├── socket.js            ← Socket.io setup
    ├── seed.js              ← Database seeder
    └── e2e.test.js          ← End-to-end test suite (58 tests)
```

---

## 🔄 Food Lifecycle

```
Restaurant creates listing
         ↓
      available
         ↓
   NGO reserves it
         ↓
      reserved
         ↓
Restaurant confirms pickup
         ↓
       picked
         ↓
   NGO marks delivered
         ↓
      delivered
         ↓
 Restaurant rates NGO ⭐

(If uncollected before expiry → node-cron marks as expired)
```

---

## 🧮 Freshness Scoring

Every listing is assigned a **freshness score (0–100)** and a **predicted expiry** based on:

| Storage Type | Max Safe Window |
|-------------|----------------|
| Room temperature | 6 hours |
| Refrigerated | 12 hours |

```
freshnessScore  = max(0, round(100 - (ageInHours / maxHours) × 100))
predictedExpiry = cookedTime + maxHours
```

The score is recalculated on every edit. Listings past their predicted expiry are automatically marked `expired` by the cron job.

---

## 🔔 Real-Time Notifications

Socket.io events keep both parties in sync without polling:

| Event | Trigger | Notified Party |
|-------|---------|----------------|
| `food_reserved` | NGO reserves food | Restaurant |
| `food_picked` | Restaurant confirms pickup | NGO |
| `food_delivered` | NGO marks delivered | Restaurant |

---

## 🗺️ Map View

NGOs can browse food on a **live Leaflet map**:

- 🟢 Green markers — available food listings
- 🔵 Blue marker — NGO's current location
- 10 km radius geospatial search (`$near` + `2dsphere` index)
- Popup on each marker shows food details
- Reserve directly from the popup without leaving the map

---

## 🔒 Security

- JWT authentication on all protected routes
- Role-based authorization (`restaurant` / `ngo` / `admin`)
- Helmet security headers
- Rate limiting — auth endpoints blocked after 10 rapid requests (429)
- MongoDB injection protection
- XSS sanitization
- Request payload size limit
- Password reset tokens hashed with SHA-256, expire in 15 minutes
- Passwords hashed with bcrypt (pre-save model hook, no double-hashing)

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MongoDB Atlas account (free tier works)
- Cloudinary account (free tier works)

### 1. Clone the repository

```bash
git clone https://github.com/AndreaF03/smart-food-redistribution.git
cd smart-food-redistribution
```

### 2. Install dependencies

```bash
# Server
cd server && npm install

# Client
cd ../client && npm install
```

### 3. Configure environment variables

Create both `.env` files as described in the [Environment Variables](#-environment-variables) section below.

### 4. Seed the database

```bash
cd server
node seed.js --fresh
```

Creates 10 restaurants, 10 NGOs, 1 admin, ~90 food listings across realistic statuses, and 14 days of historical data for the analytics charts.

### 5. Start development servers

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm start
```

| Service | URL |
|---------|-----|
| React frontend | http://localhost:3000 |
| Express API | http://localhost:5000 |

---

## 🔐 Environment Variables

### `server/.env`

```env
PORT=5000
CLIENT_URL=http://localhost:3000
NODE_ENV=development

# Database
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/foodbridge

# Auth
JWT_SECRET=your_jwt_secret_here

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Push Notifications (VAPID)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@yourdomain.com

# Email
EMAIL_USER=your_smtp_email
EMAIL_PASS=your_smtp_password
```

### `client/.env`

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

> **Note:** If `EMAIL_USER` / `EMAIL_PASS` are omitted, the mailer skips silently and the app still works. In `development`, `POST /api/auth/forgot-password` returns `_resetToken` in the response so you can test the reset flow without a live inbox.

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login, returns JWT |
| GET | `/api/auth/me` | Auth | Get current user |
| PUT | `/api/auth/me` | Auth | Update profile |
| POST | `/api/auth/forgot-password` | Public | Send reset email |
| POST | `/api/auth/reset-password/:token` | Public | Reset password |
| GET | `/api/auth/users` | Admin | List all users |
| PATCH | `/api/auth/users/:id/role` | Admin | Change user role |
| PATCH | `/api/auth/users/:id/deactivate` | Admin | Deactivate user |

### Food Listings

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/food` | Restaurant | Create listing |
| PATCH | `/api/food/:id` | Restaurant (owner) | Edit listing |
| DELETE | `/api/food/:id` | Restaurant (owner) | Delete listing |
| GET | `/api/food/nearby` | NGO | Nearby available food |
| GET | `/api/food/restaurant/dashboard` | Restaurant | Own listings |
| GET | `/api/food/ngo/dashboard` | NGO | Reserved / picked / delivered |
| GET | `/api/food/admin/analytics` | Admin | Full analytics |
| PATCH | `/api/food/reserve/:id` | NGO | Reserve a listing |
| PATCH | `/api/food/pick/:id` | Restaurant | Confirm pickup |
| PATCH | `/api/food/deliver/:id` | NGO | Mark as delivered |

### Ratings

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/ratings` | Restaurant | Rate an NGO |
| GET | `/api/ratings/my` | Restaurant | Own rated food IDs |
| GET | `/api/ratings/leaderboard` | Admin | NGO leaderboard |
| DELETE | `/api/ratings/:id` | Restaurant | Delete rating (within 24h) |

### Donations

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/donations` | Restaurant | Create donation record |
| GET | `/api/donations` | Auth | List all donations |
| GET | `/api/donations/my` | Auth | Own donation history |
| DELETE | `/api/donations/:id` | Restaurant | Delete donation |

---

## 👥 Roles & Permissions

| Action | Restaurant | NGO | Admin |
|--------|:---------:|:---:|:-----:|
| Post food listing | ✅ | ❌ | ❌ |
| Edit / delete own food | ✅ | ❌ | ❌ |
| Browse nearby food (map) | ❌ | ✅ | ❌ |
| Reserve food | ❌ | ✅ | ❌ |
| Confirm pickup | ✅ | ❌ | ❌ |
| Mark delivered | ❌ | ✅ | ❌ |
| Rate NGO | ✅ | ❌ | ❌ |
| View analytics | ❌ | ❌ | ✅ |
| Manage users | ❌ | ❌ | ✅ |
| View leaderboard | ❌ | ❌ | ✅ |

---

## 🧪 Testing

The project includes a full end-to-end API test suite — **58 tests, 58 passing**.

### Run the tests

```bash
# 1. Start the server
cd server && npm run dev

# 2. Seed fresh data
node seed.js --fresh

# 3. Run the suite
node e2e.test.js
```

### Coverage

| Section | Tests |
|---------|:-----:|
| Authentication (register, login, profile, password reset) | 17 |
| Food — Create | 5 |
| Food — Dashboards & Nearby | 6 |
| Food — Edit & Delete | 6 |
| Food — Reserve → Pick → Deliver flow | 9 |
| Ratings | 8 |
| Admin — User Management | 6 |
| Rate Limiting | 1 |
| **Total** | **58** |

### Seeded test credentials (password: `Password123`)

| Email | Role |
|-------|------|
| `admin@test.com` | Admin |
| `restaurant1@test.com` … `restaurant10@test.com` | Restaurant |
| `ngo1@test.com` … `ngo10@test.com` | NGO |
| `deactivated@test.com` | NGO (blocked — tests 403) |
| `resettest@test.com` | NGO (has live reset token) |

---

## 📁 Project Structure

```
smart-food-redistribution/
│
├── client/
│   ├── public/
│   └── src/
│       ├── api/
│       │   └── axios.js
│       ├── components/
│       │   └── ProtectedRoute.js
│       ├── pages/
│       │   ├── Login.js
│       │   ├── Register.js
│       │   ├── NGODashboard.js
│       │   ├── RestaurantDashboard.js
│       │   ├── AdminDashboard.js
│       │   └── AddDonation.js
│       └── App.js
│
└── server/
    ├── controllers/
    │   ├── authController.js
    │   ├── foodController.js
    │   ├── donationController.js
    │   └── ratingController.js
    ├── jobs/
    │   └── expireFood.js
    ├── middleware/
    │   ├── authMiddleware.js
    │   └── errorMiddleware.js
    ├── models/
    │   ├── User.js
    │   ├── Food.js
    │   ├── Donation.js
    │   └── Rating.js
    ├── routes/
    │   ├── authRoutes.js
    │   ├── foodRoutes.js
    │   ├── donationRoutes.js
    │   └── ratingRoutes.js
    ├── utils/
    │   └── mailer.js
    ├── socket.js
    ├── seed.js
    ├── e2e.test.js
    └── server.js
```

---

## 🚀 Future Improvements

- [ ] AI demand forecasting — predict which NGOs need food on which days
- [ ] Smart auto-matching — rank and notify best-fit NGOs on every new listing
- [ ] NGO achievement / badge system (Zero Waste Warrior, Speed Runner, etc.)
- [ ] Personal impact dashboard (meals saved, CO₂ avoided)
- [ ] Progressive Web App (PWA) — offline support, install to homescreen
- [ ] Push notifications (VAPID infrastructure already in place)
- [ ] Google Maps integration
- [ ] Mobile app
- [ ] Multi-language support (Hindi / English)
- [ ] Email alerts for food approaching expiry

---

## 💡 Purpose

Food waste is a major global issue while millions face hunger. This system connects restaurants with NGOs so surplus food can be redistributed efficiently, transparently, and in real time.

---

## 👩‍💻 Author

**Andrea Fernandes**

[![GitHub](https://img.shields.io/badge/GitHub-AndreaF03-181717?logo=github)](https://github.com/AndreaF03)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?logo=linkedin)](https://linkedin.com)

---

⭐ If you find this project useful, give it a **star on GitHub!**