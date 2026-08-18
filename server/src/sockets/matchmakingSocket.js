const matchmakingService = require('../services/matchmakingService');
const gameService = require('../services/gameService');
const gameState = require('../game-state/gameState');
const aiService = require('../services/aiService');
const prisma = require('../db');

module.exports = (io, socket) => {
  
  socket.on('join_queue', async ({ userId, username, rating, preset }) => {
    try {
      const result = matchmakingService.joinQueue(socket.id, userId, username, rating, preset);
      socket.emit('queue_status', { status: 'searching', preset });
      io.emit('seeks_updated', matchmakingService.getOpenSeeks());

      if (result.matched) {
        const [p1, p2] = result.players;
        
        const isP1White = Math.random() > 0.5;
        const whiteId = isP1White ? p1.userId : p2.userId;
        const blackId = isP1White ? p2.userId : p1.userId;
        
        const game = await gameService.createPvPGame(
          whiteId, 
          blackId, 
          result.timeControlSec, 
          result.incrementSec
        );

        io.to(p1.socketId).emit('match_found', { gameId: game.id, color: isP1White ? 'white' : 'black' });
        io.to(p2.socketId).emit('match_found', { gameId: game.id, color: isP1White ? 'black' : 'white' });
        
        io.emit('seeks_updated', matchmakingService.getOpenSeeks());
        io.emit('live_games_updated', gameService.getLiveGames());
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('get_live_games', () => {
    socket.emit('live_games_updated', gameService.getLiveGames());
  });

  socket.on('leave_queue', () => {
    matchmakingService.leaveQueue(socket.id);
    socket.emit('queue_status', { status: 'idle' });
    io.emit('seeks_updated', matchmakingService.getOpenSeeks());
  });

  socket.on('create_room', ({ userId, username, timeControlSec, incrementSec }) => {
    try {
      const roomId = matchmakingService.createLobby(socket.id, userId, username, timeControlSec, incrementSec);
      socket.join(`room_${roomId}`);
      socket.emit('room_created', { roomId, timeControlSec, incrementSec });
      io.emit('seeks_updated', matchmakingService.getOpenSeeks());
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('join_room', ({ roomId, userId }) => {
    try {
      const lobby = matchmakingService.joinLobby(roomId, socket.id, userId);
      socket.join(`room_${roomId}`);
      
      io.to(lobby.hostSocket).emit('room_joined', { guestId: userId });
      socket.emit('room_joined', { hostId: lobby.hostId, timeControlSec: lobby.timeControlSec, incrementSec: lobby.incrementSec });
      io.emit('seeks_updated', matchmakingService.getOpenSeeks());
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('accept_seek', async ({ targetUserId, preset, currentUserId, currentUsername, rating }) => {
    try {
      const p1 = matchmakingService.removePlayerFromQueue(targetUserId, preset);
      if (!p1) throw new Error('Seek no longer available');
      
      const p2 = { socketId: socket.id, userId: currentUserId, username: currentUsername, rating };
      
      const [minStr, incStr] = preset.split('+');
      const timeControlSec = parseInt(minStr) * 60;
      const incrementSec = parseInt(incStr);
      
      const isP1White = Math.random() > 0.5;
      const whiteId = isP1White ? p1.userId : p2.userId;
      const blackId = isP1White ? p2.userId : p1.userId;
      
      const game = await gameService.createPvPGame(whiteId, blackId, timeControlSec, incrementSec);

      io.to(p1.socketId).emit('match_found', { gameId: game.id, color: isP1White ? 'white' : 'black' });
      io.to(p2.socketId).emit('match_found', { gameId: game.id, color: isP1White ? 'black' : 'white' });
      
      io.emit('seeks_updated', matchmakingService.getOpenSeeks());
      io.emit('live_games_updated', gameService.getLiveGames());
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('start_game', async ({ roomId }) => {
    try {
      const lobby = matchmakingService.lobbies.get(roomId);
      if (!lobby) throw new Error('Lobby not found');
      if (lobby.hostSocket !== socket.id) throw new Error('Only host can start the game');
      if (!lobby.guestId) throw new Error('Need an opponent to start');

      const isHostWhite = Math.random() > 0.5;
      const whiteId = isHostWhite ? lobby.hostId : lobby.guestId;
      const blackId = isHostWhite ? lobby.guestId : lobby.hostId;

      const game = await gameService.createPvPGame(
        whiteId, 
        blackId, 
        lobby.timeControlSec, 
        lobby.incrementSec
      );

      io.to(`room_${roomId}`).emit('game_started', { 
        gameId: game.id,
        whiteId,
        blackId,
        timeControlSec: lobby.timeControlSec,
        incrementSec: lobby.incrementSec
      });

      matchmakingService.deleteLobby(roomId);
      io.emit('seeks_updated', matchmakingService.getOpenSeeks());
      io.emit('live_games_updated', gameService.getLiveGames());
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('start_ai_game', async ({ userId, difficulty, botName, timeControlSec, incrementSec, preferredColor }) => {
    try {
      const { game, humanColor } = await gameService.createAIGame(userId, difficulty, botName, timeControlSec, incrementSec, preferredColor || 'random');
      socket.emit('match_found', { gameId: game.id, color: humanColor });

      // If human is black, AI (white) moves first — trigger opening move immediately
      if (humanColor === 'black') {
        // Small delay so the client has time to join the game room
        setTimeout(async () => {
          try {
            const aiGame = gameState.getGame(game.id);
            if (!aiGame) return;

            const bestMove = await aiService.getBestMove(aiGame.chess.fen(), aiGame.aiDifficulty);
            const aiMoveResult = aiGame.chess.move(bestMove);
            
            aiGame.lastMoveTime = Date.now();

            io.to(`game_${game.id}`).emit('ai_moved', {
              move: aiMoveResult,
              whiteTimeLeftMs: aiGame.whiteTimeLeftMs,
              blackTimeLeftMs: aiGame.blackTimeLeftMs
            });

            // Persist the AI's opening move
            await prisma.move.create({
              data: {
                gameId: game.id,
                moveNumber: aiGame.chess.history().length,
                san: aiMoveResult.san,
                fenAfter: aiGame.chess.fen(),
                playerColor: 'white'
              }
            });
          } catch (e) {
            console.error('AI opening move error:', e);
          }
        }, 1500);
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('get_seeks', () => {
    socket.emit('seeks_updated', matchmakingService.getOpenSeeks());
  });

  socket.on('disconnect', () => {
    matchmakingService.leaveQueue(socket.id);
    io.emit('seeks_updated', matchmakingService.getOpenSeeks());
  });
};
