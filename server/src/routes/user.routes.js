const express = require('express');
const prisma = require('../db');
const { isAuthenticated } = require('../middleware/auth.middleware');

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

router.get('/search', isAuthenticated, async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username query is required' });
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, rating: true, showOnlineStatus: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot search for yourself here' });
    }
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
        bestRating: true,
        bestRatingDate: true,
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

    const allGames = await prisma.game.findMany({
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

    const rankedGames = allGames.filter(g => !g.isCasual);
    const casualGamesCount = allGames.length - rankedGames.length;

    let wins = 0;
    let losses = 0;
    let draws = 0;

    rankedGames.forEach(game => {
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
      stats: { wins, losses, draws, total: rankedGames.length, casualTotal: casualGamesCount, bestRating: user.bestRating, bestRatingDate: user.bestRatingDate },
      recentGames: allGames.slice(0, 20) // Give top 20 for profile
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ── Daily Challenge ───────────────────────────────────────────────────────────
// Returns (or lazily creates) today's challenge record for a user.
// "Today" is always UTC midnight so it stays consistent with DB timestamps.
function getTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

router.get('/daily-challenge', isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const challengeDate = getTodayUTC();

    // Upsert: create the row if it doesn't exist yet for today
    const [record, user] = await Promise.all([
      prisma.dailyChallenge.upsert({
        where: { userId_challengeDate: { userId, challengeDate } },
        update: {},           // nothing to update on mere read
        create: { userId, challengeDate },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { coinsBalance: true, dailyChallengeStreak: true },
      }),
    ]);

    res.json({
      completed:            record.completedAt !== null,
      rewarded:             record.rewarded,
      challengeDate:        record.challengeDate,
      streak:               user?.dailyChallengeStreak ?? 0,
      coinsBalance:         user?.coinsBalance ?? 0,
    });
  } catch (err) {
    console.error('daily-challenge GET error:', err);
    res.status(500).json({ error: 'Failed to fetch daily challenge' });
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
