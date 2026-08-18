const { Chess } = require('chess.js');
const prisma = require('../db');
const gameState = require('../game-state/gameState');

class GameService {
  async createPvPGame(whiteId, blackId, timeControlSec, incrementSec, isCasual = true) {
    const whiteUser = await prisma.user.findUnique({ where: { id: whiteId } });
    const blackUser = await prisma.user.findUnique({ where: { id: blackId } });

    const game = await prisma.game.create({
      data: {
        whiteId,
        blackId,
        vsAI: false,
        isCasual,
        timeControlSec,
        incrementSec,
        whiteTimeLeftMs: timeControlSec * 1000,
        blackTimeLeftMs: timeControlSec * 1000,
        whiteRatingAtGame: whiteUser?.rating || 1200,
        blackRatingAtGame: blackUser?.rating || 1200,
      }
    });

    // Initialize in-memory state
    gameState.setGame(game.id, {
      chess: new Chess(),
      whiteId,
      blackId,
      whiteUsername: whiteUser?.username || 'Unknown',
      blackUsername: blackUser?.username || 'Unknown',
      whiteRating: whiteUser?.rating || 1200,
      blackRating: blackUser?.rating || 1200,
      vsAI: false,
      isCasual,
      timeControlSec,
      incrementSec,
      whiteTimeLeftMs: timeControlSec * 1000,
      blackTimeLeftMs: timeControlSec * 1000,
      lastMoveTime: null
    });

    return game;
  }

  async createAIGame(playerId, aiDifficulty, aiPersonaName, timeControlSec, incrementSec, preferredColor = 'random') {
    // Resolve 'random' server-side so the client can't game it
    let humanColor = preferredColor;
    if (humanColor === 'random') {
      humanColor = Math.random() < 0.5 ? 'white' : 'black';
    }

    const humanIsWhite = humanColor === 'white';
    const whiteId = humanIsWhite ? playerId : null;
    const blackId = humanIsWhite ? null : playerId;

    const user = await prisma.user.findUnique({ where: { id: playerId } });
    
    // Map difficulty to a generic label for the live games list
    const aiLabels = {
      1: { label: 'Beginner', rating: 800 },
      3: { label: 'Club Player', rating: 1200 },
      5: { label: 'Expert', rating: 1800 },
      8: { label: 'Master', rating: 2400 },
      10: { label: 'Grandmaster', rating: 2800 }
    };
    const aiInfo = aiLabels[aiDifficulty] || { label: 'AI', rating: 1200 };
    const aiName = aiPersonaName || `AI (${aiInfo.label})`;

    const game = await prisma.game.create({
      data: {
        whiteId,
        blackId,
        vsAI: true,
        isCasual: true,
        aiDifficulty,
        aiPersonaName: aiName,
        timeControlSec,
        incrementSec,
        whiteTimeLeftMs: timeControlSec * 1000,
        blackTimeLeftMs: timeControlSec * 1000,
        whiteRatingAtGame: humanIsWhite ? user?.rating || 1200 : aiInfo.rating,
        blackRatingAtGame: humanIsWhite ? aiInfo.rating : user?.rating || 1200,
      }
    });

    gameState.setGame(game.id, {
      chess: new Chess(),
      whiteId: humanIsWhite ? playerId : 'AI',
      blackId: humanIsWhite ? 'AI' : playerId,
      whiteUsername: humanIsWhite ? user.username : aiName,
      blackUsername: humanIsWhite ? aiName : user.username,
      whiteRating: humanIsWhite ? user.rating : aiInfo.rating,
      blackRating: humanIsWhite ? aiInfo.rating : user.rating,
      vsAI: true,
      isCasual: true,
      aiDifficulty,
      timeControlSec,
      incrementSec,
      whiteTimeLeftMs: timeControlSec * 1000,
      blackTimeLeftMs: timeControlSec * 1000,
      lastMoveTime: null
    });

    return { game, humanColor };
  }
  getLiveGames() {
    const liveGames = [];
    for (const [gameId, state] of gameState.games.entries()) {
      liveGames.push({
        gameId,
        whiteUsername: state.whiteUsername,
        blackUsername: state.blackUsername,
        whiteRating: state.whiteRating,
        blackRating: state.blackRating,
        timeControlSec: state.timeControlSec,
        incrementSec: state.incrementSec
      });
    }
    return liveGames;
  }
}

module.exports = new GameService();
