const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

const initSocket = (server, clientOrigin) => {
  io = new Server(server, {
    cors: {
      origin: clientOrigin || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  /* ==========================
      AUTH MIDDLEWARE
  ========================== */
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Logic fix: Ensure we capture the ID reliably
      socket.userId = decoded.id || decoded._id;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  /* ==========================
      CONNECTION & ROOMS
  ========================== */
  io.on("connection", (socket) => {
    // Standardize the room name as a string
    const myRoom = socket.userId.toString();
    
    socket.join(myRoom);
    console.log(`[socket] User connected: ${myRoom}`);

    socket.on("disconnect", () => {
      console.log(`[socket] User disconnected: ${myRoom}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    console.warn("Socket.io not initialized");
    return null;
  }
  return io;
};

module.exports = { initSocket, getIO };