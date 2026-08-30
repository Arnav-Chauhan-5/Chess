const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev-only';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super-refresh-secret-for-dev-only';

// ── Helper: grant the free default cosmetics to a newly created user ──────────
// Looks up the isDefault=true items from each category, creates UserCosmetic
// ownership records, and sets the equipped FKs on the user.
// Wrapped in try/catch so it degrades gracefully if the seed hasn't run yet.
async function grantDefaultCosmetics(userId) {
  try {
    const [defaultTheme, defaultSet] = await Promise.all([
      prisma.cosmeticItem.findFirst({ where: { type: 'BOARD_THEME', isDefault: true } }),
      prisma.cosmeticItem.findFirst({ where: { type: 'PIECE_SET',   isDefault: true } }),
    ]);

    const creates = [];
    const update  = {};

    if (defaultTheme) {
      creates.push({ userId, cosmeticItemId: defaultTheme.id, coinsPaid: 0 });
      update.equippedBoardThemeId = defaultTheme.id;
    }
    if (defaultSet) {
      creates.push({ userId, cosmeticItemId: defaultSet.id, coinsPaid: 0 });
      update.equippedPieceSetId = defaultSet.id;
    }

    if (creates.length > 0) {
      await prisma.$transaction([
        // createMany with skipDuplicates in case the user somehow already has these
        prisma.userCosmetic.createMany({ data: creates, skipDuplicates: true }),
        prisma.user.update({ where: { id: userId }, data: update }),
      ]);
    }
  } catch (err) {
    // Non-fatal: log but don't block registration
    console.error('[grantDefaultCosmetics] Failed for userId', userId, err);
  }
}

class AuthService {
  async registerWithEmail(username, email, password) {
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      throw new Error('Username or email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email, passwordHash }
    });

    await grantDefaultCosmetics(user.id);
    const populatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { equippedBoardTheme: true, equippedPieceSet: true }
    });
    return this.generateTokens(populatedUser);
  }

  async loginWithEmail(email, password) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { equippedBoardTheme: true, equippedPieceSet: true }
    });
    if (!user || !user.passwordHash) {
      throw new Error('Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    return this.generateTokens(user);
  }

  async handleOAuthLogin(provider, profile) {
    const providerAccountId = profile.id;
    const email = profile.emails?.[0]?.value;
    const username = profile.displayName || profile.username || `user_${Date.now()}`;
    const avatarUrl = profile.photos?.[0]?.value;

    let oauthAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: { provider, providerAccountId }
      },
      include: { 
        user: { include: { equippedBoardTheme: true, equippedPieceSet: true } }
      }
    });

    if (oauthAccount) {
      return this.generateTokens(oauthAccount.user);
    }

    if (email) {
      let user = await prisma.user.findUnique({
        where: { email },
        include: { equippedBoardTheme: true, equippedPieceSet: true }
      });
      if (user) {
        await prisma.oAuthAccount.create({
          data: { provider, providerAccountId, userId: user.id }
        });
        return this.generateTokens(user);
      }
    }

    // Ensure unique username
    let uniqueUsername = username;
    let counter = 1;
    while (await prisma.user.findUnique({ where: { username: uniqueUsername } })) {
      uniqueUsername = `${username}_${counter++}`;
    }

    const newUser = await prisma.user.create({
      data: {
        username: uniqueUsername,
        email: email || `${providerAccountId}@${provider}.local`, // fallback if no email
        avatarUrl,
        oauthAccounts: {
          create: { provider, providerAccountId }
        }
      }
    });

    await grantDefaultCosmetics(newUser.id);
    const populatedUser = await prisma.user.findUnique({
      where: { id: newUser.id },
      include: { equippedBoardTheme: true, equippedPieceSet: true }
    });
    return this.generateTokens(populatedUser);
  }

  generateTokens(user) {
    const payload = { id: user.id, username: user.username };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    
    return { accessToken, refreshToken, user };
  }
}

module.exports = new AuthService();
