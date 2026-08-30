const prisma = require('../src/db');

async function debugGames() {
  // Find user with most games
  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: { gamesAsWhite: true, gamesAsBlack: true }
      }
    }
  });
  
  if (users.length === 0) return console.log("No users found.");
  
  const mostActiveUser = users.sort((a, b) => 
    (b._count.gamesAsWhite + b._count.gamesAsBlack) - (a._count.gamesAsWhite + a._count.gamesAsBlack)
  )[0];
  
  console.log(`Most active user: ${mostActiveUser.username} (${mostActiveUser.id})`);
  console.log(`Total games: ${mostActiveUser._count.gamesAsWhite + mostActiveUser._count.gamesAsBlack}`);
  
  const games = await prisma.game.findMany({
    where: {
      OR: [{ whiteId: mostActiveUser.id }, { blackId: mostActiveUser.id }],
      status: { not: 'IN_PROGRESS' }
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      isCasual: true,
      vsAI: true,
      whiteRatingAtGame: true,
      blackRatingAtGame: true,
      whiteRatingDelta: true,
      blackRatingDelta: true
    }
  });
  
  console.log("Their top 10 finished games:");
  console.log(JSON.stringify(games, null, 2));
}

debugGames().finally(() => prisma.$disconnect());
