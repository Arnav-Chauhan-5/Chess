class SocketStore {
  constructor() {
    this.userSockets = new Map(); // userId -> Set(socketId)
    this.socketUsers = new Map(); // socketId -> userId
    this.io = null;
  }

  setIo(io) {
    this.io = io;
  }

  getIo() {
    return this.io;
  }

  registerUser(socketId, userId) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socketId);
    this.socketUsers.set(socketId, userId);
  }

  removeSocket(socketId) {
    const userId = this.socketUsers.get(socketId);
    if (userId) {
      const userSocketsSet = this.userSockets.get(userId);
      if (userSocketsSet) {
        userSocketsSet.delete(socketId);
        if (userSocketsSet.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      this.socketUsers.delete(socketId);
    }
    return userId; // Return the user ID so we can broadcast status if they went offline
  }

  isOnline(userId) {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }

  getSockets(userId) {
    const set = this.userSockets.get(userId);
    return set ? Array.from(set) : [];
  }
}

module.exports = new SocketStore();
