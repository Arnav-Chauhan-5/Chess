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
  console.log("--- Users ---");
  const users = await prisma.user.findMany({
    select: { username: true, coinsBalance: true, dailyChallengeStreak: true }
  });
  console.table(users);

  console.log("\n--- Daily Challenges ---");
  const challenges = await prisma.dailyChallenge.findMany({
    include: { user: { select: { username: true } } }
  });
  const mapped = challenges.map(c => ({
    username: c.user.username,
    date: c.challengeDate.toISOString().split('T')[0],
    completed: !!c.completedAt,
    rewarded: c.rewarded
  }));
  console.table(mapped);
}

main().catch(console.error).finally(() => prisma.$disconnect());
