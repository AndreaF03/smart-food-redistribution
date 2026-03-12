# 🍽️ Smart Food Redistribution System

A **full-stack web application** that connects **restaurants with NGOs** to redistribute surplus food and reduce food waste.

Restaurants donate surplus food, NGOs discover and reserve it on a live map, and the entire lifecycle — from listing to delivery — is tracked in real time.

---

# 🌟 Features

## 🍽️ Restaurant

* Register and login securely
* Add food donations with image upload
* Automatic **freshness score** and **expiry prediction**
* View all donations with status tracking
* Confirm NGO pickup
* **Rate NGOs** after delivery (1–5 stars + comment)
* **Real-time notifications** when NGOs reserve or deliver food

## 🤝 NGO

* Browse nearby food on an **interactive map**
* Switch between **Map View** and **List View**
* View freshness score and restaurant details
* Reserve food from map popups
* Track food lifecycle
  **Reserved → Picked → Delivered**
* Receive **real-time notifications**

## 📊 Admin

* Platform-wide analytics dashboard
* Charts powered by **Recharts**
* Donation trends
* Food status breakdown
* Top NGOs leaderboard
* Top restaurants leaderboard

---

# ⚙️ Tech Stack

## Frontend

* React.js
* React Router
* Axios
* Socket.io Client
* React Leaflet
* Recharts

## Backend

* Node.js
* Express.js
* MongoDB
* Mongoose
* JWT Authentication
* Socket.io
* node-cron
* Cloudinary
* Helmet
* express-rate-limit

---

# 🗂️ Project Structure

smart-food-redistribution

client
│
├── src
│   ├── api
│   │   └── axios.js
│   ├── components
│   │   └── ProtectedRoute.js
│   ├── pages
│   │   ├── Login.js
│   │   ├── Register.js
│   │   ├── NGODashboard.js
│   │   ├── RestaurantDashboard.js
│   │   ├── AdminDashboard.js
│   │   └── AddDonation.js
│   └── App.js

server
│
├── controllers
│   ├── authController.js
│   ├── foodController.js
│   ├── donationController.js
│   └── ratingController.js

├── jobs
│   └── expireFood.js

├── middleware
│   ├── authMiddleware.js
│   └── errorMiddleware.js

├── models
│   ├── User.js
│   ├── Food.js
│   ├── Donation.js
│   └── Rating.js

├── routes
│   ├── authRoutes.js
│   ├── foodRoutes.js
│   ├── donationRoutes.js
│   └── ratingRoutes.js

├── socket.js
└── server.js

README.md

---

# ⚙️ Installation

## 1️⃣ Clone repository

git clone https://github.com/AndreaF03/smart-food-redistribution.git
cd smart-food-redistribution

---

## 2️⃣ Install backend dependencies

cd server
npm install

---

## 3️⃣ Install frontend dependencies

cd client
npm install

---

# 🔐 Environment Variables

Create a **.env file inside the server folder**

PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_keyxyzzz
CLIENT_URL=http://localhost:3000
NODE_ENV=development

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

---

Create a **.env file inside the client folder**

REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000

---

# ▶️ Running the Application

## Start backend

cd server
npm run dev

---

## Start frontend

cd client
npm start

Frontend → http://localhost:3000
Backend → http://localhost:5000

---

# 🔌 API Endpoints

## Authentication

POST /api/auth/register
POST /api/auth/login

---

## Food

POST /api/food
GET /api/food/nearby
PATCH /api/food/reserve/:id
PATCH /api/food/pick/:id
PATCH /api/food/deliver/:id

GET /api/food/ngo/dashboard
GET /api/food/restaurant/dashboard
GET /api/food/admin/analytics

---

## Ratings

POST /api/ratings
GET /api/ratings/my
GET /api/ratings/ngo/:ngoId

---

## Donations

POST /api/donations
GET /api/donations
GET /api/donations/my
DELETE /api/donations/:id

---

# 🔄 Food Lifecycle

Restaurant creates listing

↓

active

↓

NGO reserves

↓

reserved

↓

Restaurant confirms pickup

↓

picked

↓

NGO delivers

↓

delivered

↓

Restaurant rates NGO ⭐

If food is not collected before expiry, a **node-cron job** automatically marks it as **expired**.

---

# 🔔 Real-Time Notifications

food_reserved → NGO reserves food → Restaurant notified

food_picked → Restaurant confirms pickup → NGO notified

food_delivered → NGO delivers food → Restaurant notified

---

# 🗺️ Map View

NGOs can view food on a **live map**.

* Green markers → available food
* Blue marker → NGO location
* 10km radius search
* Popup shows food details
* Reserve directly from popup

---

# 🔒 Security

* JWT authentication
* Role-based authorization
* Helmet security headers
* Rate limiting
* MongoDB injection protection
* XSS sanitization
* Request payload limit

---

# 👤 User Roles

Restaurant

* Create food
* Confirm pickup
* Rate NGOs

NGO

* Reserve food
* Confirm delivery

Admin

* View analytics dashboard

---

# 🚀 Future Improvements

* Push notifications
* AI demand prediction
* NGO rating history pages
* Google Maps integration
* Mobile app
* Email alerts for expiring food

---

# 💡 Purpose

Food waste is a major global issue while millions face hunger.
This system connects restaurants with NGOs so surplus food can be redistributed efficiently and transparently.

---

# 👩‍💻 Author

Andrea Fernandes

GitHub
https://github.com/AndreaF03

LinkedIn
https://linkedin.com

---

⭐ If you like this project, give it a **star on GitHub**.
