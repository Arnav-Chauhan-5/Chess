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

router.get('/search', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username query is required' });
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, rating: true, showOnlineStatus: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/profile', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        username: true, 
        rating: true, 
        avatarUrl: true, 
        createdAt: true,
        showOnlineStatus: true,
        passwordHash: true, // Need this to check if they can unlink
        oauthAccounts: {
          select: { provider: true, providerAccountId: true }
        }
      }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const games = await prisma.game.findMany({
      where: {
        OR: [{ whiteId: userId }, { blackId: userId }],
        status: { not: 'IN_PROGRESS' }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        whitePlayer: { select: { id: true, username: true, rating: true } },
        blackPlayer: { select: { id: true, username: true, rating: true } }
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

    // Remove password hash before sending to client
    const hasPassword = !!user.passwordHash;
    delete user.passwordHash;

    res.json({ 
      user: { ...user, hasPassword }, 
      stats: { wins, losses, draws, total: games.length },
      recentGames: games.slice(0, 20) // Give top 20 for profile
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.patch('/profile', async (req, res) => {
  try {
    // In a real app, verify authentication token here.
    const { userId, username, avatarUrl } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // Ensure username is unique if changed
    if (username) {
      const existing = await prisma.user.findFirst({
        where: { username, NOT: { id: userId } }
      });
      if (existing) return res.status(400).json({ error: 'Username is already taken' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        ...(username && { username }), 
        ...(avatarUrl !== undefined && { avatarUrl }) 
      }
    });

    res.json({ user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.patch('/settings', async (req, res) => {
  try {
    const { userId, showOnlineStatus } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(showOnlineStatus !== undefined && { showOnlineStatus })
      }
    });

    res.json({ user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.delete('/oauth/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { userId } = req.query; // Real app: from token
    if (!userId || !provider) return res.status(400).json({ error: 'Missing parameters' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { oauthAccounts: true }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check lockout rules: Must have a password OR at least one other oauth account
    if (!user.passwordHash && user.oauthAccounts.length <= 1) {
      return res.status(400).json({ error: 'Cannot unlink final login method' });
    }

    await prisma.oAuthAccount.deleteMany({
      where: { userId, provider }
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unlink account' });
  }
});

module.exports = router;
