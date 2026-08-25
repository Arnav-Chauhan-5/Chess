require('dotenv').config();
const prisma = require('../src/db');

async function test() {
  const all = await prisma.friendship.findMany();
  console.log('All friendships:');
  console.log(all);
  process.exit(0);
}
test();
