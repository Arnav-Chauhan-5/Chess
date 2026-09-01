const gameState = require('../game-state/gameState');
const aiService = require('../services/aiService');
const gameService = require('../services/gameService');
const notificationService = require('../services/notificationService');
const prisma = require('../db');
const socketStore = require('./socketStore');

// Track which userId is associated with which socket, and pending disconnect timers
const userSockets = new Map();    // userId -> Set<socketId>
const socketUsers = new Map();    // socketId -> { userId, gameIds: Set }
const disconnectTimers = new Map(); // `${gameId}:${userId}` -> timeoutId

const RECONNECT_GRACE_MS = 30000; // 30 seconds

// Server-side clock check intervals per game
const clockIntervals = new Map(); // gameId -> intervalId

const DAILY_CHALLENGE_COINS = 50; // Coins awarded per daily challenge completion

// ── Daily Challenge helper ────────────────────────────────────────────────────
// Called after every qualifying game finish (WHITE_WON, BLACK_WON, DRAW).
// Upserts today's DailyChallenge row for each human player and, on the first
// qualifying game of the day:
//   • Marks the challenge as completed
//   • Awards DAILY_CHALLENGE_COINS coins to the user
//   • Updates the consecutive-day streak (resets to 1 if yesterday wasn't done)
//   • Sets rewarded = true so the award can't fire twice
//   • Emits 'daily_challenge_updated' to that user's socket room
async function markDailyChallenge(io, userId) {
  if (!userId) return;
  try {
    const now = new Date();
    const challengeDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    // ── FIX ──────────────────────────────────────────────────────────────────
    // The previous code passed `{ completedAt: { set: undefined } }` in the
    // update block, which Prisma v7 rejects with:
    //   "Expected DateTime or Null, provided Object"
    // This threw on every call and was swallowed by the catch — meaning
    // completedAt was never set and coins were never awarded.
    // Fix: pass an empty update: {} so upsert just returns the existing row.
    const record = await prisma.dailyChallenge.upsert({
      where: { userId_challengeDate: { userId, challengeDate } },
      update: {},           // idempotent read — only the create branch is new
      create: { userId, challengeDate },
    });

    // Only proceed if not already completed today (prevents double-award)
    if (!record.completedAt) {
      // ── Streak calculation ──────────────────────────────────────────────
      const yesterday = new Date(challengeDate.getTime() - 24 * 60 * 60 * 1000);
      const [yesterdayRecord, userRow] = await Promise.all([
        prisma.dailyChallenge.findUnique({
          where: { userId_challengeDate: { userId, challengeDate: yesterday } },
          select: { completedAt: true },
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { dailyChallengeStreak: true },
        }),
      ]);

      const newStreak = yesterdayRecord?.completedAt
        ? (userRow?.dailyChallengeStreak ?? 0) + 1  // consecutive day → increment
        : 1;                                          // streak broken → reset to 1

      // ── Persist completion + award ──────────────────────────────────────
      await Promise.all([
        prisma.dailyChallenge.update({
          where: { id: record.id },
          data: { completedAt: now, rewarded: true },
        }),
        prisma.user.update({
          where: { id: userId },
          data: {
            coinsBalance:         { increment: DAILY_CHALLENGE_COINS },
            dailyChallengeStreak: newStreak,
          },
        }),
      ]);

      // ── Notify client ───────────────────────────────────────────────────
      io.to(`user_${userId}`).emit('daily_challenge_updated', {
        completed:    true,
        coinsAwarded: DAILY_CHALLENGE_COINS,
        streak:       newStreak,
      });

      console.log(`[markDailyChallenge] userId=${userId} completed. Streak=${newStreak}, coins+=${DAILY_CHALLENGE_COINS}`);
    }
  } catch (err) {
    // Non-fatal — don't let a challenge tracking failure break the game
    console.error('[markDailyChallenge] error for userId', userId, err);
  }
}


function stopClockCheck(gameId) {
  const intervalId = clockIntervals.get(gameId);
  if (intervalId) {
    clearInterval(intervalId);
    clockIntervals.delete(gameId);
  }
}

// Extracted game finalization logic to handle DB update, rating calculation, and emit
async function finalizeGame(io, gameId, game, status, reason) {
  console.log(`[finalizeGame] Started for gameId: ${gameId}, status: ${status}, reason: ${reason}`);
  let whiteDelta = null;
  let blackDelta = null;
  let pgn = game.chess.pgn();
  console.log(`[finalizeGame] PGN generated.`);

  // Elo rating calculation (only for non-casual PvP games)
  if (!game.isCasual && !game.vsAI && game.whiteId && game.blackId) {
    try {
      const whiteUser = await prisma.user.findUnique({ where: { id: game.whiteId } });
      const blackUser = await prisma.user.findUnique({ where: { id: game.blackId } });
      
      if (whiteUser && blackUser) {
        const Rw = whiteUser.rating;
        const Rb = blackUser.rating;
        
        const Ew = 1 / (1 + Math.pow(10, (Rb - Rw) / 400));
        const Eb = 1 / (1 + Math.pow(10, (Rw - Rb) / 400));
        
        let Sw = 0.5;
        let Sb = 0.5;
        if (status === 'WHITE_WON') { Sw = 1; Sb = 0; }
        else if (status === 'BLACK_WON') { Sw = 0; Sb = 1; }
        
        const K = 32;
        whiteDelta = Math.round(K * (Sw - Ew));
        blackDelta = Math.round(K * (Sb - Eb));
        
        const postWhiteRating = Rw + whiteDelta;
        const postBlackRating = Rb + blackDelta;
        
        const whiteData = { rating: { increment: whiteDelta } };
        if (whiteUser.bestRating === null || postWhiteRating > whiteUser.bestRating) {
          whiteData.bestRating = postWhiteRating;
          whiteData.bestRatingDate = new Date();
        }
        
        const blackData = { rating: { increment: blackDelta } };
        if (blackUser.bestRating === null || postBlackRating > blackUser.bestRating) {
          blackData.bestRating = postBlackRating;
          blackData.bestRatingDate = new Date();
        }

        // Update users
        await prisma.user.update({
          where: { id: whiteUser.id },
          data: whiteData
        });
        
        await prisma.user.update({
          where: { id: blackUser.id },
          data: blackData
        });
      }
    } catch (err) {
      console.error('Error calculating Elo:', err);
    }
  }

  console.log(`[finalizeGame] Preparing to persist to DB. isCasual: ${game.isCasual}, whiteDelta: ${whiteDelta}, blackDelta: ${blackDelta}`);
  try {
    await prisma.game.update({
      where: { id: gameId },
      data: { 
        status, 
        endReason: reason, 
        pgn, 
        endedAt: new Date(),
        whiteRatingDelta: whiteDelta,
        blackRatingDelta: blackDelta
      }
    });
    console.log(`[finalizeGame] DB persistence successful.`);
  } catch (e) { 
    console.error(`[finalizeGame] Game finalize persist error:`, e); 
  }

  console.log(`[finalizeGame] Emitting game_over to room game_${gameId}`);
  io.to(`game_${gameId}`).emit('game_over', { 
    reason, 
    status, 
    pgn,
    whiteRatingDelta: whiteDelta,
    blackRatingDelta: blackDelta
  });
  
  gameState.deleteGame(gameId);
  stopClockCheck(gameId);
  aiService.cleanupEngine(gameId);
  
  // Broadcast updated live games list since one just finished
  io.emit('live_games_updated', gameService.getLiveGames());

  // ── Daily challenge tracking ─────────────────────────────────────────────
  // Any terminal status (WHITE_WON, BLACK_WON, DRAW) counts as qualifying.
  // Mark challenge complete for both human participants.
  const isQualifying = ['WHITE_WON', 'BLACK_WON', 'DRAW'].includes(status);
  if (isQualifying) {
    const humanWhiteId = game.whiteId !== 'AI' ? game.whiteId : null;
    const humanBlackId = game.blackId !== 'AI' ? game.blackId : null;
    await Promise.all([
      markDailyChallenge(io, humanWhiteId),
      markDailyChallenge(io, humanBlackId),
    ]);
  }


}

function startClockCheck(io, gameId) {
  if (clockIntervals.has(gameId)) return;

  const intervalId = setInterval(async () => {
    const game = gameState.getGame(gameId);
    if (!game) {
      clearInterval(intervalId);
      clockIntervals.delete(gameId);
      return;
    }

    // Update time if a move has started
    if (game.lastMoveTime) {
      const now = Date.now();
      const elapsed = now - game.lastMoveTime;
      
      if (game.chess.turn() === 'w') {
        const remaining = game.whiteTimeLeftMs - elapsed;
        if (remaining <= 0) {
          game.whiteTimeLeftMs = 0;
          game.lastMoveTime = now;
          await finalizeGame(io, gameId, game, 'BLACK_WON', 'TIMEOUT');
          return;
        }
      } else {
        const remaining = game.blackTimeLeftMs - elapsed;
        if (remaining <= 0) {
          game.blackTimeLeftMs = 0;
          game.lastMoveTime = now;
          await finalizeGame(io, gameId, game, 'WHITE_WON', 'TIMEOUT');
          return;
        }
      }
    }
  }, 1000); // Check every second

  clockIntervals.set(gameId, intervalId);
}

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
    try {
      await prisma.move.create({
        data: {
          gameId,
          moveNumber: game.chess.history().length,
          san: moveResult.san,
          fenAfter: game.chess.fen(),
          playerColor: game.chess.turn() === 'b' ? 'white' : 'black' // color who just moved
        }
      });
      console.log(`[endTurn] Move saved to DB for game ${gameId}`);
    } catch (dbErr) {
      console.error(`[endTurn] Failed to save move to DB:`, dbErr);
      // Do not throw; allow the game to continue in memory even if DB fails
    }

    // Check game over
    if (game.chess.isGameOver()) {
      let reason = 'DRAW_AGREEMENT'; // generic draw
      let status = 'DRAW';
      if (game.chess.isCheckmate()) {
        reason = 'CHECKMATE';
        status = game.chess.turn() === 'b' ? 'WHITE_WON' : 'BLACK_WON';
      } else if (game.chess.isStalemate()) {
        reason = 'STALEMATE';
      } else if (game.chess.isThreefoldRepetition()) {
        reason = 'THREEFOLD_REPETITION';
      } else if (game.chess.isInsufficientMaterial()) {
        reason = 'INSUFFICIENT_MATERIAL';
      }

      await finalizeGame(io, gameId, game, status, reason);
      return true; // Game over
    }
    return false; // Game continues
  };

  socket.on('join_game_room', ({ gameId, userId }) => {
    socket.join(`game_${gameId}`);
    
    // Track this socket's userId and game membership
    if (userId) {
      if (!socketUsers.has(socket.id)) {
        socketUsers.set(socket.id, { userId, gameIds: new Set() });
      }
      socketUsers.get(socket.id).gameIds.add(gameId);

      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId).add(socket.id);

      // Cancel any pending disconnect timer for this user in this game
      const timerKey = `${gameId}:${userId}`;
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey));
        disconnectTimers.delete(timerKey);
        // Notify opponent that we reconnected
        socket.to(`game_${gameId}`).emit('opponent_reconnected');
      }
    }

    const game = gameState.getGame(gameId);
    if (game) {
      // Recalculate time before sending sync
      if (game.lastMoveTime) {
        calculateTime(game);
        game.lastMoveTime = Date.now();
      }

      socket.emit('game_state_sync', {
        fen: game.chess.fen(),
        whiteId: game.whiteId,
        blackId: game.blackId,
        whiteTimeLeftMs: game.whiteTimeLeftMs,
        blackTimeLeftMs: game.blackTimeLeftMs,
        lastMoveTime: game.lastMoveTime,
        vsAI: game.vsAI,
        isCasual: game.isCasual,
        hasStarted: !!game.lastMoveTime
      });

      // If the game hasn't officially started (no first move yet)
      if (!game.lastMoveTime) {
        if (game.vsAI) {
          socket.emit('players_ready');
        } else {
          // Check if both human players are currently connected
          const whiteConnected = game.whiteId && userSockets.has(game.whiteId) && userSockets.get(game.whiteId).size > 0;
          const blackConnected = game.blackId && userSockets.has(game.blackId) && userSockets.get(game.blackId).size > 0;
          if (whiteConnected && blackConnected) {
            io.to(`game_${gameId}`).emit('players_ready');
          }
        }
      }

      // Start server-side clock check if a move has been made
      if (game.lastMoveTime) {
        startClockCheck(io, gameId);
      }
    }
  });

  socket.on('make_move', async ({ gameId, userId, move }) => {
    console.log(`[make_move] Received move from ${userId} for game ${gameId}: ${move}`);
    try {
      const game = getActiveGame(gameId);
      console.log(`[make_move] Active game found, turn: ${game.chess.turn()}, whiteId: ${game.whiteId}, blackId: ${game.blackId}`);
      
      // Verify turn authorization
      const isWhiteTurn = game.chess.turn() === 'w';
      const authorizedUserId = isWhiteTurn ? game.whiteId : game.blackId;
      
      if (userId !== authorizedUserId) {
        console.error(`[make_move] Turn auth failed! userId: ${userId} (${typeof userId}), authorizedUserId: ${authorizedUserId} (${typeof authorizedUserId})`);
        throw new Error('Not your turn');
      }
      
      console.log(`[make_move] Turn auth passed.`);

      // Calculate time before making the move
      calculateTime(game);

      if (game.whiteTimeLeftMs <= 0 || game.blackTimeLeftMs <= 0) {
         // Handle timeout
         const status = game.whiteTimeLeftMs <= 0 ? 'BLACK_WON' : 'WHITE_WON';
         await finalizeGame(io, gameId, game, status, 'TIMEOUT');
         return;
      }

      // Validate and apply move
      console.log(`[make_move] Applying move: ${move}`);
      const moveResult = game.chess.move(move);
      if (!moveResult) {
        console.error(`[make_move] Invalid move!`);
        throw new Error('Invalid move');
      }
      
      console.log(`[make_move] Move applied successfully.`);

      game.lastMoveTime = Date.now();

      // Start server-side clock check after the first move
      startClockCheck(io, gameId);

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
      console.log(`[make_move] endTurn completed. isGameOver: ${isGameOver}, vsAI: ${game.vsAI}`);

      if (!isGameOver && game.vsAI) {
        console.log(`[make_move] Triggering AI move...`);
        // Trigger AI move
        setTimeout(async () => {
          try {
            const aiGame = getActiveGame(gameId);
            calculateTime(aiGame);
            
            const bestMove = await aiService.getBestMove(gameId, aiGame.chess.fen(), aiGame.aiDifficulty);
            const aiMoveResult = aiGame.chess.move(bestMove);
            
            aiGame.lastMoveTime = Date.now();
            
            io.to(`game_${gameId}`).emit('ai_moved', {
              move: aiMoveResult,
              whiteTimeLeftMs: aiGame.whiteTimeLeftMs,
              blackTimeLeftMs: aiGame.blackTimeLeftMs
            });
            
            await endTurn(gameId, aiGame, aiMoveResult);
            console.log(`[make_move] AI move completed.`);
          } catch (e) {
            console.error('AI Move Error:', e);
          }
        }, 500); // slight delay for realism
      }

    } catch (err) {
      console.error('Make Move Error:', err);
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('send_message', ({ gameId, text, username }) => {
    io.to(`game_${gameId}`).emit('receive_message', {
      text,
      username,
      timestamp: Date.now()
    });
  });

  socket.on('resign', async ({ gameId, userId }) => {
    console.log('[Server] Received resign event for gameId:', gameId, 'userId:', userId);
    try {
      const game = getActiveGame(gameId);
      const isWhite = userId === game.whiteId;
      const status = isWhite ? 'BLACK_WON' : 'WHITE_WON';
      await finalizeGame(io, gameId, game, status, 'RESIGNATION');
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('offer_draw', async ({ gameId, userId }) => {
    try {
      const game = getActiveGame(gameId);
      if (!game) return;
      socket.to(`game_${gameId}`).emit('draw_offered');

      const opponentId = game.whiteId === userId ? game.blackId : game.whiteId;
      if (opponentId && !game.vsAI) {
        prisma.user.findUnique({ where: { id: userId } }).then(requester => {
          if (requester) {
            notificationService.createNotification({
              userId: opponentId,
              type: 'DRAW_OFFER',
              message: `${requester.username} offered a draw.`,
              data: { gameId }
            }).catch(err => console.error('Failed to create DRAW_OFFER notification', err));
          }
        });
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('respond_draw', async ({ gameId, userId, accept }) => {
    try {
      const game = getActiveGame(gameId);
      if (!game) return;

      if (accept) {
        await finalizeGame(io, gameId, game, 'DRAW', 'DRAW_AGREEMENT');
      } else {
        socket.to(`game_${gameId}`).emit('draw_declined');
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // Rematch feature
  socket.on('request_rematch', async ({ gameId, userId }) => {
    try {
      // Allow rematch even if game ended (so we fetch from DB)
      const gameRecord = await prisma.game.findUnique({ where: { id: gameId } });
      if (!gameRecord) return;
      
      if (gameRecord.vsAI) {
        // Instantly start new game for AI
        const newGame = await gameService.createAIGame(
          userId, 
          gameRecord.aiDifficulty, 
          gameRecord.aiPersonaName,
          gameRecord.timeControlSec, 
          gameRecord.incrementSec,
          gameRecord.whiteId === userId ? 'black' : 'white' // swap colors
        );
        socket.emit('game_started', { gameId: newGame.game.id });
      } else {
        socket.to(`game_${gameId}`).emit('rematch_requested');
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('respond_rematch', async ({ gameId, userId, accept }) => {
    try {
      const gameRecord = await prisma.game.findUnique({ where: { id: gameId } });
      if (!gameRecord) return;

      if (accept) {
        // Swap colors
        const newWhiteId = gameRecord.blackId;
        const newBlackId = gameRecord.whiteId;
        
        const newGame = await gameService.createPvPGame(
          newWhiteId, 
          newBlackId, 
          gameRecord.timeControlSec, 
          gameRecord.incrementSec,
          gameRecord.isCasual
        );
        
        io.to(`game_${gameId}`).emit('game_started', { gameId: newGame.id });
        io.emit('live_games_updated', gameService.getLiveGames());
      } else {
        socket.to(`game_${gameId}`).emit('rematch_declined');
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // Takeback feature
  socket.on('request_takeback', ({ gameId, userId }) => {
    try {
      const game = getActiveGame(gameId);
      if (!game.isCasual) throw new Error('Takebacks only allowed in casual games');
      
      if (game.vsAI) {
        // Auto-accept AI takeback. Undo twice to give user their turn back.
        game.chess.undo();
        game.chess.undo();
        
        // Let's delete the last two moves from DB (optional, but good for consistency)
        prisma.move.findMany({
          where: { gameId },
          orderBy: { moveNumber: 'desc' },
          take: 2
        }).then(moves => {
          if (moves.length === 2) {
             prisma.move.deleteMany({ where: { id: { in: moves.map(m => m.id) } } }).catch(console.error);
          }
        });

        // Give a little time back maybe? Not strictly necessary for AI.
        io.to(`game_${gameId}`).emit('takeback_accepted', {
          fen: game.chess.fen(),
          whiteTimeLeftMs: game.whiteTimeLeftMs,
          blackTimeLeftMs: game.blackTimeLeftMs
        });

      } else {
        socket.to(`game_${gameId}`).emit('takeback_requested');
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('respond_takeback', async ({ gameId, userId, accept }) => {
    try {
      const game = getActiveGame(gameId);
      if (!game) return;

      if (accept) {
        game.chess.undo();
        
        // Remove the last move from the database
        const lastMove = await prisma.move.findFirst({
          where: { gameId },
          orderBy: { moveNumber: 'desc' }
        });
        if (lastMove) {
          await prisma.move.delete({ where: { id: lastMove.id } });
        }

        // Add back some time if we were strictly tracking?
        // (For a casual game, rolling back clocks slightly is complex, we just stick to current clock).
        
        io.to(`game_${gameId}`).emit('takeback_accepted', {
          fen: game.chess.fen(),
          whiteTimeLeftMs: game.whiteTimeLeftMs,
          blackTimeLeftMs: game.blackTimeLeftMs
        });
      } else {
        socket.to(`game_${gameId}`).emit('takeback_declined');
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });


  // Fix 2: Handle disconnect — start reconnect grace period
  socket.on('disconnect', () => {
    const socketData = socketUsers.get(socket.id);
    if (!socketData) return;

    const { userId, gameIds } = socketData;

    // Remove this socket from tracking
    socketUsers.delete(socket.id);
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) userSockets.delete(userId);
    }

    // For each game this socket was in, check if the user still has other sockets
    for (const gameId of gameIds) {
      const game = gameState.getGame(gameId);
      if (!game) continue;

      // Skip AI games — no need for disconnect handling
      if (game.vsAI) continue;

      // Check if user still has another socket in this game
      const remainingSockets = userSockets.get(userId);
      if (remainingSockets && remainingSockets.size > 0) continue;

      // Notify opponent of disconnect
      socket.to(`game_${gameId}`).emit('opponent_disconnected');

      // Start grace period timer
      const timerKey = `${gameId}:${userId}`;
      const timerId = setTimeout(async () => {
        disconnectTimers.delete(timerKey);
        
        const g = gameState.getGame(gameId);
        if (!g) return;

        // Auto-resign the disconnected player
        const isWhite = userId === g.whiteId;
        const status = isWhite ? 'BLACK_WON' : 'WHITE_WON';
        await finalizeGame(io, gameId, g, status, 'ABANDONED');
      }, RECONNECT_GRACE_MS);

      disconnectTimers.set(timerKey, timerId);
    }
  });
};
