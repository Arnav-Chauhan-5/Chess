const gameState = require('../game-state/gameState');
const aiService = require('../services/aiService');
const prisma = require('../db');

module.exports = (io, socket) => {

  const getActiveGame = (gameId) => {
    const game = gameState.getGame(gameId);
    if (!game) throw new Error('Game not found or already ended');
    return game;
  };

  const calculateTime = (game) => {
    if (!game.lastMoveTime) return;
    const now = Date.now();
    const elapsed = now - game.lastMoveTime;
    
    if (game.chess.turn() === 'w') {
      game.whiteTimeLeftMs -= elapsed;
    } else {
      game.blackTimeLeftMs -= elapsed;
    }
    game.lastMoveTime = now;
  };

  const endTurn = async (gameId, game, moveResult) => {
    // Add increment to the player who just moved
    if (game.chess.turn() === 'b') { 
      // White just moved
      game.whiteTimeLeftMs += game.incrementSec * 1000;
    } else {
      // Black just moved
      game.blackTimeLeftMs += game.incrementSec * 1000;
    }

    // Persist move
    await prisma.move.create({
      data: {
        gameId,
        moveNumber: game.chess.history().length,
        san: moveResult.san,
        fenAfter: game.chess.fen(),
        playerColor: game.chess.turn() === 'b' ? 'white' : 'black' // color who just moved
      }
    });

    // Check game over
    if (game.chess.isGameOver()) {
      let reason = 'DRAW';
      let status = 'DRAW';
      if (game.chess.isCheckmate()) {
        reason = 'CHECKMATE';
        status = game.chess.turn() === 'b' ? 'WHITE_WON' : 'BLACK_WON';
      } else if (game.chess.isStalemate()) {
        reason = 'STALEMATE';
      } else if (game.chess.isThreefoldRepetition()) {
        reason = 'THREEFOLD_REPETITION';
      }

      await prisma.game.update({
        where: { id: gameId },
        data: { status, endReason: reason, pgn: game.chess.pgn(), endedAt: new Date() }
      });

      io.to(`game_${gameId}`).emit('game_over', { reason, status });
      gameState.deleteGame(gameId);
      return true; // Game over
    }
    return false; // Game continues
  };

  socket.on('join_game_room', ({ gameId }) => {
    socket.join(`game_${gameId}`);
    const game = gameState.getGame(gameId);
    if (game) {
      socket.emit('game_state_sync', {
        fen: game.chess.fen(),
        whiteTimeLeftMs: game.whiteTimeLeftMs,
        blackTimeLeftMs: game.blackTimeLeftMs,
        lastMoveTime: game.lastMoveTime,
        vsAI: game.vsAI
      });
    }
  });

  socket.on('make_move', async ({ gameId, userId, move }) => {
    try {
      const game = getActiveGame(gameId);
      
      // Verify turn authorization
      const isWhiteTurn = game.chess.turn() === 'w';
      const authorizedUserId = isWhiteTurn ? game.whiteId : game.blackId;
      
      if (userId !== authorizedUserId) {
        throw new Error('Not your turn');
      }

      // Calculate time before making the move
      calculateTime(game);

      if (game.whiteTimeLeftMs <= 0 || game.blackTimeLeftMs <= 0) {
         // Handle timeout
         const status = game.whiteTimeLeftMs <= 0 ? 'BLACK_WON' : 'WHITE_WON';
         await prisma.game.update({
           where: { id: gameId },
           data: { status, endReason: 'TIMEOUT', pgn: game.chess.pgn(), endedAt: new Date() }
         });
         io.to(`game_${gameId}`).emit('game_over', { reason: 'TIMEOUT', status });
         gameState.deleteGame(gameId);
         return;
      }

      // Validate and apply move
      const moveResult = game.chess.move(move);
      if (!moveResult) throw new Error('Invalid move');

      game.lastMoveTime = Date.now();

      // Broadcast move
      socket.to(`game_${gameId}`).emit('opponent_moved', { 
        move: moveResult, 
        whiteTimeLeftMs: game.whiteTimeLeftMs,
        blackTimeLeftMs: game.blackTimeLeftMs
      });

      // Confirm to sender (optional, client might optimistically update)
      socket.emit('move_confirmed', { 
        move: moveResult,
        whiteTimeLeftMs: game.whiteTimeLeftMs,
        blackTimeLeftMs: game.blackTimeLeftMs
      });

      const isGameOver = await endTurn(gameId, game, moveResult);

      if (!isGameOver && game.vsAI) {
        // Trigger AI move
        setTimeout(async () => {
          try {
            const aiGame = getActiveGame(gameId);
            calculateTime(aiGame);
            
            const bestMove = await aiService.getBestMove(aiGame.chess.fen(), aiGame.aiDifficulty);
            const aiMoveResult = aiGame.chess.move(bestMove);
            
            aiGame.lastMoveTime = Date.now();
            
            io.to(`game_${gameId}`).emit('ai_moved', {
              move: aiMoveResult,
              whiteTimeLeftMs: aiGame.whiteTimeLeftMs,
              blackTimeLeftMs: aiGame.blackTimeLeftMs
            });
            
            await endTurn(gameId, aiGame, aiMoveResult);
          } catch (e) {
            console.error('AI Move Error:', e);
          }
        }, 500); // slight delay for realism
      }

    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('resign', async ({ gameId, userId }) => {
    try {
      const game = getActiveGame(gameId);
      const isWhite = userId === game.whiteId;
      const status = isWhite ? 'BLACK_WON' : 'WHITE_WON';
      
      await prisma.game.update({
        where: { id: gameId },
        data: { status, endReason: 'RESIGNATION', pgn: game.chess.pgn(), endedAt: new Date() }
      });
      
      io.to(`game_${gameId}`).emit('game_over', { reason: 'RESIGNATION', status });
      gameState.deleteGame(gameId);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });
};
