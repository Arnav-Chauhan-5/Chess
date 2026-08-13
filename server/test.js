const prisma = require('./src/db');
async function test() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) return console.log('No user found to test with.');
    
    console.log('Testing with user ID:', user.id);
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        id: true, 
        username: true, 
        rating: true, 
        avatarUrl: true, 
        createdAt: true,
        showOnlineStatus: true,
        passwordHash: true, 
        oauthAccounts: {
          select: { provider: true, providerAccountId: true }
        }
      }
    });
    console.log('Success:', !!profile);
  } catch (err) {
    console.error('ERROR:\n', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
