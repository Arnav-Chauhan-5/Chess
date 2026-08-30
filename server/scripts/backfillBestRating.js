const prisma = require('../src/db');

async function backfillBestRating() {
  console.log('Starting bestRating backfill...');
  
  // Get all users
  const users = await prisma.user.findMany({
    select: { id: true, rating: true }
  });
  
  console.log(`Found ${users.length} users to process.`);
  
  let updatedCount = 0;
  
  for (const user of users) {
    // Fetch all finished games where this user was a participant
    const games = await prisma.game.findMany({
      where: {
        OR: [{ whiteId: user.id }, { blackId: user.id }],
        status: { not: 'IN_PROGRESS' }
      },
      orderBy: { createdAt: 'asc' },
      select: {
        whiteId: true,
        blackId: true,
        whiteRatingAtGame: true,
        whiteRatingDelta: true,
        blackRatingAtGame: true,
        blackRatingDelta: true,
        endedAt: true,
        createdAt: true
      }
    });
    
    if (games.length === 0) {
      // If a user has no games, their best rating is just their current base rating (e.g., 1200)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          bestRating: user.rating,
          bestRatingDate: new Date()
        }
      });
      updatedCount++;
      continue;
    }
    
    let bestRating = user.rating; // Default fallback just in case history is corrupted
    let bestRatingDate = new Date();
    
    // We scan through chronologically to find the highest post-game rating
    for (const game of games) {
      const isWhite = game.whiteId === user.id;
      const ratingAtGame = isWhite ? game.whiteRatingAtGame : game.blackRatingAtGame;
      const delta = isWhite ? game.whiteRatingDelta : game.blackRatingDelta;
      
      if (ratingAtGame != null && delta != null) {
        const postGameRating = ratingAtGame + delta;
        if (bestRating === null || postGameRating > bestRating) {
          bestRating = postGameRating;
          bestRatingDate = game.endedAt || game.createdAt;
        }
      }
    }
    
    // Write back exactly those two fields
    await prisma.user.update({
      where: { id: user.id },
      data: {
        bestRating: bestRating,
        bestRatingDate: bestRatingDate
      }
    });
    updatedCount++;
  }
  
  console.log(`Backfill complete. Updated ${updatedCount} users.`);
}

backfillBestRating()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
