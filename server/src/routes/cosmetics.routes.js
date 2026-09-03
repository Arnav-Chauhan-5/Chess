const express = require("express");
const prisma = require("../db");
const { isAuthenticated } = require("../middleware/auth.middleware");

const router = express.Router();

// ── GET /cosmetics/catalog?userId=<id> ────────────────────────────────────────
// Returns the full catalog with an `owned` and `equipped` flag per item.
router.get("/catalog", isAuthenticated, async (req, res) => {
  try {
    const userId = req.query.userId || req.user?.id;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const [items, user] = await Promise.all([
      prisma.cosmeticItem.findMany({ orderBy: [{ type: "asc" }, { coinCost: "asc" }] }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          coinsBalance: true,
          equippedBoardThemeId: true,
          equippedPieceSetId: true,
          ownedCosmetics: { select: { cosmeticItemId: true } },
        },
      }),
    ]);

    if (!user) return res.status(404).json({ error: "User not found" });

    const ownedSet = new Set(user.ownedCosmetics.map((uc) => uc.cosmeticItemId));

    const catalog = items.map((item) => ({
      ...item,
      owned: ownedSet.has(item.id),
      equipped:
        item.id === user.equippedBoardThemeId ||
        item.id === user.equippedPieceSetId,
    }));

    res.json({
      catalog,
      coinsBalance: user.coinsBalance,
      equippedBoardThemeId: user.equippedBoardThemeId,
      equippedPieceSetId: user.equippedPieceSetId,
    });
  } catch (err) {
    console.error("[GET /cosmetics/catalog]", err);
    res.status(500).json({ error: "Failed to fetch catalog" });
  }
});

// ── GET /cosmetics/equipped/:userId ──────────────────────────────────────────
// Returns the currently equipped board theme and piece set for a user.
router.get("/equipped/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        coinsBalance: true,
        equippedBoardTheme: true,
        equippedPieceSet: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("[GET /cosmetics/equipped]", err);
    res.status(500).json({ error: "Failed to fetch equipped cosmetics" });
  }
});

// ── POST /cosmetics/purchase ─────────────────────────────────────────────────
// Body: { userId, cosmeticItemId }
// Deducts coins, creates UserCosmetic record. Auto-equips the purchased item.
router.post("/purchase", isAuthenticated, async (req, res) => {
  try {
    const { userId, cosmeticItemId } = req.body;
    if (!userId || !cosmeticItemId)
      return res.status(400).json({ error: "userId and cosmeticItemId required" });

    const [user, item] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          coinsBalance: true,
          equippedBoardThemeId: true,
          equippedPieceSetId: true,
          ownedCosmetics: { select: { cosmeticItemId: true } },
        },
      }),
      prisma.cosmeticItem.findUnique({ where: { id: cosmeticItemId } }),
    ]);

    if (!user) return res.status(404).json({ error: "User not found" });
    if (!item) return res.status(404).json({ error: "Item not found" });

    const alreadyOwned = user.ownedCosmetics.some(
      (uc) => uc.cosmeticItemId === cosmeticItemId
    );
    if (alreadyOwned)
      return res.status(409).json({ error: "Item already owned" });

    if (user.coinsBalance < item.coinCost)
      return res.status(402).json({ error: "Insufficient coins", coinsBalance: user.coinsBalance });

    // Deduct coins + create ownership + auto-equip
    const equipField =
      item.type === "BOARD_THEME" ? "equippedBoardThemeId" : "equippedPieceSetId";

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          coinsBalance: { decrement: item.coinCost },
          [equipField]: cosmeticItemId,
        },
        select: { coinsBalance: true, equippedBoardThemeId: true, equippedPieceSetId: true, equippedBoardTheme: true, equippedPieceSet: true },
      }),
      prisma.userCosmetic.create({
        data: { userId, cosmeticItemId, coinsPaid: item.coinCost },
      }),
    ]);

    res.json({ success: true, item, updatedUser });
  } catch (err) {
    console.error("[POST /cosmetics/purchase]", err);
    res.status(500).json({ error: "Failed to purchase item" });
  }
});

// ── POST /cosmetics/equip ────────────────────────────────────────────────────
// Body: { userId, cosmeticItemId }
// Equips an already-owned cosmetic. No coin cost.
router.post("/equip", isAuthenticated, async (req, res) => {
  try {
    const { userId, cosmeticItemId } = req.body;
    if (!userId || !cosmeticItemId)
      return res.status(400).json({ error: "userId and cosmeticItemId required" });

    const [user, item] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { ownedCosmetics: { select: { cosmeticItemId: true } } },
      }),
      prisma.cosmeticItem.findUnique({ where: { id: cosmeticItemId }, select: { type: true } }),
    ]);

    if (!user) return res.status(404).json({ error: "User not found" });
    if (!item) return res.status(404).json({ error: "Item not found" });

    const owns = user.ownedCosmetics.some((uc) => uc.cosmeticItemId === cosmeticItemId);
    if (!owns) return res.status(403).json({ error: "Item not owned" });

    const equipField =
      item.type === "BOARD_THEME" ? "equippedBoardThemeId" : "equippedPieceSetId";

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { [equipField]: cosmeticItemId },
      select: { coinsBalance: true, equippedBoardThemeId: true, equippedPieceSetId: true, equippedBoardTheme: true, equippedPieceSet: true },
    });

    res.json({ success: true, updatedUser });
  } catch (err) {
    console.error("[POST /cosmetics/equip]", err);
    res.status(500).json({ error: "Failed to equip item" });
  }
});

module.exports = router;
