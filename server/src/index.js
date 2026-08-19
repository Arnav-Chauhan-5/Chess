require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const passport = require('./auth/passport');
const registerMatchmakingHandlers = require('./sockets/matchmakingSocket');
const registerGameHandlers = require('./sockets/gameSocket');
const registerFriendHandlers = require('./sockets/friendSocket');
const socketStore = require('./sockets/socketStore');
const friendService = require('./services/friendService');

const cookieParser = require('cookie-parser');

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

const connectedSockets = new Set();
socketStore.setIo(io);

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  connectedSockets.add(socket.id);
  io.emit('online_count', connectedSockets.size);
  
  socket.on('register_user', async ({ userId }) => {
    socketStore.registerUser(socket.id, userId);
    // Broadcast status to friends
    await friendService.broadcastStatusToFriends(io, userId, true);
  });

  registerMatchmakingHandlers(io, socket);
  registerGameHandlers(io, socket);
  registerFriendHandlers(io, socket);

  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}`);
    connectedSockets.delete(socket.id);
    io.emit('online_count', connectedSockets.size);

    const userId = socketStore.removeSocket(socket.id);
    if (userId && !socketStore.isOnline(userId)) {
      await friendService.broadcastStatusToFriends(io, userId, false);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
