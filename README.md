# 🍽️ Smart Food Redistribution System

A **full-stack web application** that connects **restaurants with NGOs** to redistribute surplus food and reduce food waste.

Restaurants can donate leftover food, and NGOs can reserve and collect it before it expires.

---

##  Features Implemented

###  Restaurant Features

* Register and login securely
* Add food donations
* Upload food images
* Set expiry time for food
* View all their donations
* Track donation status:

  * Available
  * Reserved
  * Picked
  * Delivered
  * Expired
* Delete donations

###  NGO Features

* View available food donations
* See restaurant details
* View food images
* Reserve available donations

###  Dashboard

Restaurant dashboard shows:

* Total donations
* Available donations
* Reserved donations
* Picked donations
* Delivered donations
* Expired donations

---

## Tech Stack

### Frontend

* React.js
* React Router
* Axios
* CSS

### Backend

* Node.js
* Express.js
* MongoDB
* Mongoose
* JWT Authentication
* Multer (image upload)

### Security

* Helmet
* Express Rate Limiting
* JWT Token Authentication

---

## Project Structure

```
smart-food-redistribution
│
├── client
│   ├── src
│   │   ├── pages
│   │   ├── components
│   │   ├── api
│   │   └── App.js
│
├── server
│   ├── controllers
│   │   ├── authController.js
│   │   └── donationController.js
│   │
│   ├── middleware
│   │   ├── authMiddleware.js
│   │   └── errorMiddleware.js
│   │
│   ├── models
│   │   ├── User.js
│   │   └── Donation.js
│   │
│   ├── routes
│   │   ├── authRoutes.js
│   │   └── donationRoutes.js
│   │
│   ├── uploads
│   │
│   └── server.js
│
└── README.md
```

---

## ⚙️ Installation

### 1 Clone the repository

```
git clone https://github.com/YOUR_USERNAME/smart-food-redistribution.git
```

### 2️ Install backend dependencies

```
cd server
npm install
```

### 3️ Install frontend dependencies

```
cd client
npm install
```

---

## ▶️ Running the Application

### Start backend

```
cd server
npm run dev
```

### Start frontend

```
cd client
npm start
```

---

##  Environment Variables

Create a `.env` file in the **server folder**.

```
PORT=5000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d
```

---

## Image Upload

Food images are stored in:

```
server/uploads
```

Images are served via:

```
http://localhost:5000/uploads/filename.jpg
```

---

##  API Endpoints

### Authentication

```
POST /api/auth/register
POST /api/auth/login
```

### Donations

```
POST   /api/donations        → Create donation (Restaurant)
GET    /api/donations        → View donations (NGO)
GET    /api/donations/my     → Restaurant donations
DELETE /api/donations/:id    → Delete donation
```

---

##  Future Improvements

* NGO reservation system
* Pickup tracking
* Real-time notifications
* Map-based pickup location
* Food expiry alerts
* Admin dashboard
* Mobile responsiveness

---

##  Purpose

Food waste is a major global issue. This project aims to **connect restaurants with NGOs** so that surplus food reaches people in need instead of being wasted.

---

##  Author

Andrea Fernandes

* GitHub: https://github.com/AndreaF03
* LinkedIn: https://linkedin.com

---

If you found this project useful, consider giving it a **star on GitHub**!
