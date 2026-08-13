const socketStore = require('./socketStore');
const gameService = require('../services/gameService');
const notificationService = require('../services/notificationService');

module.exports = (io, socket) => {
  socket.on('challenge_friend', ({ fromUserId, fromUsername, toUserId, timeControlSec, incrementSec }) => {
    // Check if target is online
    if (!socketStore.isOnline(toUserId)) {
      socket.emit('error', { message: 'Friend is currently offline.' });
      return;
    }

    const targetSockets = socketStore.getSockets(toUserId);
    for (const sid of targetSockets) {
      io.to(sid).emit('friend_challenge_received', {
        fromUserId,
        fromUsername,
        timeControlSec,
        incrementSec
      });
    }

    // Always create a notification, it will be sent live as well
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
    if (accept) {
      try {
        const isWhite = Math.random() > 0.5;
        const whiteId = isWhite ? fromUserId : toUserId;
        const blackId = isWhite ? toUserId : fromUserId;
        
        const game = await gameService.createPvPGame(whiteId, blackId, timeControlSec, incrementSec);

        // Notify both players
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
        
        // Broadcast new game to live spectator list
        io.emit('live_games_updated', gameService.getLiveGames());
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    } else {
      // Notify the challenger that it was declined
      const challengerSockets = socketStore.getSockets(fromUserId);
      for (const sid of challengerSockets) {
        io.to(sid).emit('friend_challenge_declined', { byUserId: toUserId });
      }
    }
  });
};
