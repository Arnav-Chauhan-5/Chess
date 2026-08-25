const socketStore = require('./socketStore');
const gameService = require('../services/gameService');
const notificationService = require('../services/notificationService');
const prisma = require('../db');

// In-memory set of pending challenges: "fromUserId:toUserId"
// Prevents the same pair from stacking up multiple simultaneous challenges.
const pendingChallenges = new Set();

module.exports = (io, socket) => {
  socket.on('challenge_friend', async ({ fromUserId, fromUsername, toUserId, timeControlSec, incrementSec }) => {
    // Check if target is online
    if (!socketStore.isOnline(toUserId)) {
      socket.emit('error', { message: 'Friend is currently offline.' });
      return;
    }

    // Prevent duplicate pending challenges between the same pair
    const challengeKey = `${fromUserId}:${toUserId}`;
    const reverseKey = `${toUserId}:${fromUserId}`;
    if (pendingChallenges.has(challengeKey) || pendingChallenges.has(reverseKey)) {
      socket.emit('error', { message: 'A challenge between you and this friend is already pending.' });
      return;
    }

    pendingChallenges.add(challengeKey);

    // Auto-expire after 75 seconds (gives 60s for the recipient + buffer)
    setTimeout(() => {
      pendingChallenges.delete(challengeKey);
    }, 75000);

    // Deliver real-time event to recipient
    const targetSockets = socketStore.getSockets(toUserId);
    for (const sid of targetSockets) {
      io.to(sid).emit('friend_challenge_received', {
        fromUserId,
        fromUsername,
        timeControlSec,
        incrementSec
      });
    }

    // Persist notification (so it survives if they close the modal)
    notificationService.createNotification({
      userId: toUserId,
      type: 'CHALLENGE',
      message: `${fromUsername} challenged you to a game (${timeControlSec / 60}+${incrementSec})`,
      data: {
        fromUserId,
        fromUsername,
        timeControlSec,
        incrementSec
      }
    }).catch(err => console.error('Failed to create CHALLENGE notification', err));
  });

  socket.on('respond_friend_challenge', async ({ fromUserId, toUserId, accept, timeControlSec, incrementSec }) => {
    // Clean up the pending challenge entry regardless of response
    const challengeKey = `${fromUserId}:${toUserId}`;
    pendingChallenges.delete(challengeKey);

    if (accept) {
      try {
        const isWhite = Math.random() > 0.5;
        const whiteId = isWhite ? fromUserId : toUserId;
        const blackId = isWhite ? toUserId : fromUserId;
        
        const game = await gameService.createPvPGame(whiteId, blackId, timeControlSec, incrementSec);

        // Notify both players to navigate into the game room
        const p1Sockets = socketStore.getSockets(fromUserId);
        const p2Sockets = socketStore.getSockets(toUserId);

        const notify = (sockets, color) => {
          for (const sid of sockets) {
            io.to(sid).emit('game_started', {
              gameId: game.id,
              whiteId,
              blackId,
              timeControlSec,
              incrementSec,
              color
            });
          }
        };

        notify(p1Sockets, isWhite ? 'white' : 'black');
        notify(p2Sockets, isWhite ? 'black' : 'white');
        
        // Broadcast updated live games list to spectators
        io.emit('live_games_updated', gameService.getLiveGames());
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    } else {
      // Look up the decliner's username to show a meaningful toast on the challenger's side
      let byUsername = null;
      try {
        const decliner = await prisma.user.findUnique({ where: { id: toUserId }, select: { username: true } });
        byUsername = decliner?.username || null;
      } catch (_) {}

      // Notify the challenger that the challenge was declined
      const challengerSockets = socketStore.getSockets(fromUserId);
      for (const sid of challengerSockets) {
        io.to(sid).emit('friend_challenge_declined', { byUserId: toUserId, byUsername });
      }
    }
  });
};
