const express = require('express');
const prisma = require('../db');

const router = express.Router();

router.get('/recent', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const games = await prisma.game.findMany({
      where: {
        OR: [
          { whiteId: userId },
          { blackId: userId }
        ],
        status: { not: 'IN_PROGRESS' } // Only show completed/aborted games
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: parseInt(req.query.limit) || 5,
      include: {
        whitePlayer: { select: { id: true, username: true, rating: true } },
        blackPlayer: { select: { id: true, username: true, rating: true } }
      }
    });

    res.json({ games });
  } catch (error) {
    console.error('Error fetching recent games:', error);
    res.status(500).json({ error: 'Failed to fetch recent games' });
  }
});

module.exports = router;
