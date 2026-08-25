require('dotenv').config();
const prisma = require('../src/db');

async function test() {
  const users = await prisma.user.findMany({
    where: {
      id: { in: ['99734ed9-df7c-44ff-b81c-f37f1a29b7c9', '3ab41bab-e7ac-4288-af16-583d26febf52', '70a0ef19-a3c5-4513-9f18-d1ba99b0e46b'] }
    }
  });
  console.log(users.map(u => ({ id: u.id, username: u.username })));
  process.exit(0);
}
test();
