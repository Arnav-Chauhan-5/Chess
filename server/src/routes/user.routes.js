const express = require('express');
const prisma = require('../db');

const router = express.Router();

router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const users = await prisma.user.findMany({
      orderBy: { rating: 'desc' },
      take: limit,
      select: { id: true, username: true, rating: true, avatarUrl: true }
    });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.get('/profile', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, rating: true, avatarUrl: true, createdAt: true }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const games = await prisma.game.findMany({
      where: {
        OR: [{ whiteId: userId }, { blackId: userId }],
        status: { not: 'IN_PROGRESS' }
      }
    });

    let wins = 0;
    let losses = 0;
    let draws = 0;

    games.forEach(game => {
      const isWhite = game.whiteId === userId;
      if (game.status === 'DRAW') {
        draws++;
      } else if (game.status === 'WHITE_WON') {
        isWhite ? wins++ : losses++;
      } else if (game.status === 'BLACK_WON') {
        !isWhite ? wins++ : losses++;
      }
    });

    res.json({ user, stats: { wins, losses, draws, total: games.length } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;
