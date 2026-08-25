require('dotenv').config();
const prisma = require('./src/db.js');

async function test() {
  const userId = '70a0ef19-a3c5-4513-9f18-d1ba99b0e46b';
  const games = await prisma.game.findMany({
      where: {
        OR: [{ whiteId: userId }, { blackId: userId }],
        status: { not: 'IN_PROGRESS' }
      },
      orderBy: { createdAt: 'desc' }
    });
  
  console.log("TOTAL COMPLETED GAMES:", games.length);
  
  let currentStreak = 0;
  let streakBroken = false;
  
  games.forEach(game => {
      const isWhite = game.whiteId === userId;
      const won = (isWhite && game.status === 'WHITE_WON') || (!isWhite && game.status === 'BLACK_WON');
      console.log(`[${game.createdAt.toISOString()}] isWhite=${isWhite}, status=${game.status}, WON=${won}`);
      
      if (!streakBroken) {
          if (won) {
              currentStreak++;
          } else {
              streakBroken = true;
          }
      }
  });
  
  console.log("COMPUTED STREAK:", currentStreak);
}
test().finally(() => prisma.$disconnect());
