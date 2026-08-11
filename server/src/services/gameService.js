const { Chess } = require('chess.js');
const prisma = require('../db');
const gameState = require('../game-state/gameState');

class GameService {
  async createPvPGame(whiteId, blackId, timeControlSec, incrementSec) {
    const game = await prisma.game.create({
      data: {
        whiteId,
        blackId,
        vsAI: false,
        timeControlSec,
        incrementSec,
        whiteTimeLeftMs: timeControlSec * 1000,
        blackTimeLeftMs: timeControlSec * 1000,
      }
    });

    // Initialize in-memory state
    gameState.setGame(game.id, {
      chess: new Chess(),
      whiteId,
      blackId,
      timeControlSec,
      incrementSec,
      whiteTimeLeftMs: timeControlSec * 1000,
      blackTimeLeftMs: timeControlSec * 1000,
      lastMoveTime: null
    });

    return game;
  }

  async createAIGame(playerId, aiDifficulty, timeControlSec, incrementSec) {
    // Player is always white for simplicity, or randomize later
    const game = await prisma.game.create({
      data: {
        whiteId: playerId,
        blackId: null, // AI
        vsAI: true,
        aiDifficulty,
        timeControlSec,
        incrementSec,
        whiteTimeLeftMs: timeControlSec * 1000,
        blackTimeLeftMs: timeControlSec * 1000,
      }
    });

    gameState.setGame(game.id, {
      chess: new Chess(),
      whiteId: playerId,
      blackId: 'AI',
      vsAI: true,
      aiDifficulty,
      timeControlSec,
      incrementSec,
      whiteTimeLeftMs: timeControlSec * 1000,
      blackTimeLeftMs: timeControlSec * 1000,
      lastMoveTime: null
    });

    return game;
  }
}

module.exports = new GameService();
