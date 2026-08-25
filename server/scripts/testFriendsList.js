require('dotenv').config();
const prisma = require('../src/db');
const friendService = require('../src/services/friendService');

async function test() {
  try {
    const list = await friendService.getFriendsList('3ab41bab-e7ac-4288-af16-583d26febf52');
    console.log(JSON.stringify(list, null, 2));
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
test();
