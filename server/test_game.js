const { io } = require("socket.io-client");
const { PrismaClient } = require('@prisma/client');
const prisma = require('./src/db');

async function test() {
  // Get two random users
  const users = await prisma.user.findMany({ take: 2 });
  if (users.length < 2) {
    console.log("Need 2 users in db");
    process.exit(1);
  }
  const u1 = users[0];
  const u2 = users[1];

  console.log(`Using users ${u1.username} and ${u2.username}`);

  const socket1 = io("http://localhost:3000");
  const socket2 = io("http://localhost:3000");

  socket1.on("connect", () => {
    console.log("S1 connected");
    socket1.emit("authenticate", { token: null, userId: u1.id });
  });

  socket1.on("authenticated", () => {
    console.log("S1 authenticated");
    // Challenge u2
    socket1.emit("challenge_friend", {
      fromUserId: u1.id,
      fromUsername: u1.username,
      toUserId: u2.id,
      timeControlSec: 300,
      incrementSec: 0
    });
  });

  socket2.on("connect", () => {
    console.log("S2 connected");
    socket2.emit("authenticate", { token: null, userId: u2.id });
  });

  socket2.on("friend_challenge", (challenge) => {
    console.log("S2 received challenge");
    socket2.emit("respond_friend_challenge", {
      fromUserId: challenge.fromUserId,
      toUserId: u2.id,
      accept: true,
      timeControlSec: 300,
      incrementSec: 0
    });
  });

  let gameId;
  socket1.on("game_started", (data) => {
    console.log("S1 game_started", data);
    gameId = data.gameId;
    socket1.emit("join_game_room", { gameId, userId: u1.id });
  });

  socket2.on("game_started", (data) => {
    console.log("S2 game_started", data);
    socket2.emit("join_game_room", { gameId: data.gameId, userId: u2.id });
  });

  socket1.on("game_state_sync", () => {
    console.log("S1 game_state_sync. Resigning...");
    socket1.emit("resign", { gameId, userId: u1.id });
  });

  socket1.on("game_over", async (data) => {
    console.log("S1 game_over", data);
    
    // Check db
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    console.log("DB Game:", game);
    
    process.exit(0);
  });
}

test();
