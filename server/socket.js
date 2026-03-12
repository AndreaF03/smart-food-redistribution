const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

const initSocket = (server, clientOrigin) => {
  io = new Server(server, {
    cors: {
      origin: clientOrigin,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  /* ==========================
     AUTH MIDDLEWARE
  ========================== */

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // attach authenticated user to socket
      socket.userId = decoded.id;

      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  /* ==========================
     CONNECTION
  ========================== */

  io.on("connection", (socket) => {
    console.log(`User ${socket.userId} connected (${socket.id})`);

    // Auto join private notification room
    socket.join(socket.userId);

    socket.on("disconnect", () => {
      console.log(`User ${socket.userId} disconnected`);
    });
  });

  return io;
};

/* ==========================
   SAFE ACCESSOR
========================== */

const getIO = () => {
  if (!io) {
    console.warn("Socket.io not initialized — skipping emit");
    return null;
  }
  return io;
};

module.exports = {
  initSocket,
  getIO
};