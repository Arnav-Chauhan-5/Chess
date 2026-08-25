const prisma = require('./src/db');

async function check() {
  const games = await prisma.game.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  console.log(games);
  process.exit(0);
}

check();
