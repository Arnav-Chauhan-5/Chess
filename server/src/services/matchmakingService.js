const { v4: uuidv4 } = require('uuid');

// Queue structure: { [timeControlKey]: [ { socketId, userId, rating, ... } ] }
// Presets: '1+0', '3+2', '5+0', '10+0', '15+10'

class MatchmakingService {
  constructor() {
    this.queues = {
      '1+0': [],
      '3+2': [],
      '5+0': [],
      '10+0': [],
      '15+10': []
    };
    
    // Active ephemeral lobbies: { [roomId]: { hostId, hostSocket, guestId, timeControlSec, incrementSec } }
    this.lobbies = new Map();
  }

  joinQueue(socketId, userId, username, rating, preset) {
    if (!this.queues[preset]) {
      throw new Error('Invalid time control preset');
    }
    
    // Ensure user isn't already in this queue
    this.leaveQueue(socketId);
    
    const player = { socketId, userId, username, rating };
    this.queues[preset].push(player);
    
    return this.checkForMatch(preset);
  }

  leaveQueue(socketId) {
    for (const preset in this.queues) {
      this.queues[preset] = this.queues[preset].filter(p => p.socketId !== socketId);
    }
  }

  removePlayerFromQueue(userId, preset) {
    if (!this.queues[preset]) return null;
    const index = this.queues[preset].findIndex(p => p.userId === userId);
    if (index !== -1) {
      return this.queues[preset].splice(index, 1)[0];
    }
    return null;
  }

  checkForMatch(preset) {
    const queue = this.queues[preset];
    if (queue.length >= 2) {
      // In a real app, we'd find closest rating. For MVP, just take first 2.
      const p1 = queue.shift();
      const p2 = queue.shift();
      
      // Parse preset to seconds for DB
      const [minStr, incStr] = preset.split('+');
      const timeControlSec = parseInt(minStr) * 60;
      const incrementSec = parseInt(incStr);
      
      return {
        matched: true,
        players: [p1, p2],
        timeControlSec,
        incrementSec
      };
    }
    return { matched: false };
  }

  createLobby(hostSocketId, hostUserId, username, timeControlSec, incrementSec) {
    const roomId = uuidv4().substring(0, 8); // Short ID for easy sharing
    this.lobbies.set(roomId, {
      roomId,
      hostId: hostUserId,
      username,
      hostSocket: hostSocketId,
      guestId: null,
      guestSocket: null,
      timeControlSec,
      incrementSec
    });
    return roomId;
  }

  joinLobby(roomId, guestSocketId, guestUserId) {
    const lobby = this.lobbies.get(roomId);
    if (!lobby) throw new Error('Lobby not found');
    if (lobby.guestId) throw new Error('Lobby is full');
    
    lobby.guestId = guestUserId;
    lobby.guestSocket = guestSocketId;
    return lobby;
  }

  getOpenSeeks() {
    const seeks = [];
    
    // Quick Pairing Seeks
    for (const preset in this.queues) {
      for (const player of this.queues[preset]) {
        seeks.push({
          type: 'queue',
          userId: player.userId,
          username: player.username,
          rating: player.rating,
          preset: preset,
        });
      }
    }
    
    // Custom Lobby Seeks
    for (const [roomId, lobby] of this.lobbies.entries()) {
      if (!lobby.guestId) {
        seeks.push({
          type: 'lobby',
          roomId: roomId,
          userId: lobby.hostId, // For consistency in the UI
          username: lobby.username,
          timeControlSec: lobby.timeControlSec,
          incrementSec: lobby.incrementSec
        });
      }
    }
    
    return seeks;
  }

  deleteLobby(roomId) {
    this.lobbies.delete(roomId);
  }
}

module.exports = new MatchmakingService();
