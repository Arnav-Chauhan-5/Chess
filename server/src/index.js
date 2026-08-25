require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const passport = require('./auth/passport');
const registerMatchmakingHandlers = require('./sockets/matchmakingSocket');
const registerGameHandlers = require('./sockets/gameSocket');
const registerFriendHandlers = require('./sockets/friendSocket');
const socketStore = require('./sockets/socketStore');
const friendService = require('./services/friendService');

const cookieParser = require('cookie-parser');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev-only';

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Routes
app.use('/auth', require('./routes/auth.routes'));
app.use('/games', require('./routes/game.routes'));
app.use('/users', require('./routes/user.routes'));
app.use('/friends', require('./routes/friend.routes'));
app.use('/notifications', require('./routes/notification.routes'));

socketStore.setIo(io);

// ─── Socket.io auth middleware ─────────────────────────────────────────────
// Runs before every connection is accepted. Reads the JWT from socket.auth.token,
// verifies it, and attaches userId to socket.data so handlers can trust it.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    // Allow unauthenticated connections for spectators/public pages,
    // but don't register them in the presence store.
    socket.data.userId = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.data.userId = payload.id;
    next();
  } catch (err) {
    // Invalid/expired token — still allow connection but mark as anonymous
    socket.data.userId = null;
    next();
  }
});

// ─── Presence tracking (raw socket count for the lobby counter) ───────────
const connectedSockets = new Set();

io.on('connection', async (socket) => {
  socket.onAny((event, ...args) => {
    console.log(`[Socket.onAny] event: ${event} from socket: ${socket.id}`);
  });

  connectedSockets.add(socket.id);
  io.emit('online_count', connectedSockets.size);

  socket.on('get_online_count', () => {
    socket.emit('online_count', connectedSockets.size);
  });

  const userId = socket.data.userId;

  // ── Register authenticated user in the presence store immediately ────────
  if (userId) {
    const wasOffline = !socketStore.isOnline(userId);
    socketStore.registerUser(socket.id, userId);

    // Only broadcast online transition once (first tab/window)
    if (wasOffline) {
      await friendService.broadcastStatusToFriends(io, userId, true);
    }
  }

  // Keep the manual register_user handler for backwards compatibility
  // (e.g. unauthenticated sockets that later identify themselves)
  socket.on('register_user', async ({ userId: manualUserId }) => {
    if (!manualUserId || socket.data.userId === manualUserId) return; // already registered
    socket.data.userId = manualUserId;
    const wasOffline = !socketStore.isOnline(manualUserId);
    socketStore.registerUser(socket.id, manualUserId);
    if (wasOffline) {
      await friendService.broadcastStatusToFriends(io, manualUserId, true);
    }
  });

  registerMatchmakingHandlers(io, socket);
  registerGameHandlers(io, socket);
  registerFriendHandlers(io, socket);

  socket.on('disconnect', async () => {
    connectedSockets.delete(socket.id);
    io.emit('online_count', connectedSockets.size);

    const disconnectedUserId = socketStore.removeSocket(socket.id);
    if (disconnectedUserId && !socketStore.isOnline(disconnectedUserId)) {
      // User's last socket disconnected — they're now offline
      await friendService.broadcastStatusToFriends(io, disconnectedUserId, false);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
