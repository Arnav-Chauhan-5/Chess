require('dotenv/config');
const prisma = require('./src/db');

async function main() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!user) return console.log('No user');
  
  await prisma.game.create({
    data: {
      status: 'WHITE_WON',
      whiteId: user.id,
      blackId: user.id,
      isCasual: true,
      vsAI: true,
      aiPersonaName: 'Rookie Sam',
      pgn: '',
      timeControlSec: 600,
      incrementSec: 0
    }
  });
  console.log('Created game for', user.username);
}

main().catch(console.error).finally(() => prisma.$disconnect());
