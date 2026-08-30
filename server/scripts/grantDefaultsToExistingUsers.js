/**
 * scripts/grantDefaultsToExistingUsers.js
 *
 * One-time backfill: grants the free default board theme and piece set to every
 * existing user who does not yet own them, and sets their equipped slots.
 *
 * Safe to re-run (uses skipDuplicates + only updates users who lack equipped IDs).
 *
 * Usage:
 *   node scripts/grantDefaultsToExistingUsers.js
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

let adapter;
if (process.env.DATABASE_URL) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  adapter = new PrismaPg(pool);
}
const prisma = new PrismaClient(adapter ? { adapter } : undefined);

async function main() {
  const [defaultTheme, defaultSet] = await Promise.all([
    prisma.cosmeticItem.findFirst({ where: { type: "BOARD_THEME", isDefault: true } }),
    prisma.cosmeticItem.findFirst({ where: { type: "PIECE_SET", isDefault: true } }),
  ]);
  if (!defaultTheme || !defaultSet) {
    console.error("Default cosmetics not found. Run node prisma/seed.js first.");
    process.exit(1);
  }

  const users = await prisma.user.findMany({ select: { id: true, equippedBoardThemeId: true, equippedPieceSetId: true } });
  let count = 0;
  for (const user of users) {
    const owns = await prisma.userCosmetic.findMany({ where: { userId: user.id, cosmeticItemId: { in: [defaultTheme.id, defaultSet.id] } }, select: { cosmeticItemId: true } });
    const ownedIds = new Set(owns.map((o) => o.cosmeticItemId));
    const creates = [];
    if (!ownedIds.has(defaultTheme.id)) creates.push({ userId: user.id, cosmeticItemId: defaultTheme.id, coinsPaid: 0 });
    if (!ownedIds.has(defaultSet.id))   creates.push({ userId: user.id, cosmeticItemId: defaultSet.id,   coinsPaid: 0 });
    const updateData = {};
    if (!user.equippedBoardThemeId) updateData.equippedBoardThemeId = defaultTheme.id;
    if (!user.equippedPieceSetId)   updateData.equippedPieceSetId   = defaultSet.id;
    if (creates.length > 0 || Object.keys(updateData).length > 0) {
      await prisma.$transaction([
        ...(creates.length > 0 ? [prisma.userCosmetic.createMany({ data: creates, skipDuplicates: true })] : []),
        ...(Object.keys(updateData).length > 0 ? [prisma.user.update({ where: { id: user.id }, data: updateData })] : []),
      ]);
      count++;
    }
  }
  console.log("Backfill complete. Updated " + count + " users.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
