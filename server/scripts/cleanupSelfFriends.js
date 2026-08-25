require('dotenv').config();
const prisma = require('../src/db');

async function cleanup() {
  console.log('Finding self-referencing friendships...');
  
  // Unfortunately Prisma doesn't support comparing two columns directly in deleteMany
  // So we must fetch them first
  const allFriendships = await prisma.friendship.findMany();
  const selfFriendships = allFriendships.filter(f => f.requesterId === f.addresseeId);
  
  if (selfFriendships.length === 0) {
    console.log('No self-referencing friendships found.');
  } else {
    console.log(`Found ${selfFriendships.length} self-referencing friendships. Deleting...`);
    
    let deletedCount = 0;
    for (const f of selfFriendships) {
      await prisma.friendship.delete({
        where: { id: f.id }
      });
      deletedCount++;
    }
    
    console.log(`Successfully deleted ${deletedCount} self-referencing friendships.`);
  }

  await prisma.$disconnect();
}

cleanup().catch(e => {
  console.error(e);
  process.exit(1);
});
