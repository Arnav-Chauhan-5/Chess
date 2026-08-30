const prisma = require('../src/db');

async function checkGames() {
  const games = await prisma.game.findMany({
    where: { 
      status: { not: 'IN_PROGRESS' }
    },
    take: 5,
    orderBy: { endedAt: 'desc' },
    select: {
      id: true,
      whiteRatingAtGame: true,
      blackRatingAtGame: true,
      whiteRatingDelta: true,
      blackRatingDelta: true,
      status: true,
      isCasual: true,
      vsAI: true
    }
  });

  console.log(JSON.stringify(games, null, 2));
}

checkGames().finally(() => prisma.$disconnect());
