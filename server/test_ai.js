const io = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');

const userId = uuidv4();
const socket = io('http://localhost:3000', {
  extraHeaders: {
    Origin: 'http://localhost:5173'
  }
});

let gameId = null;

socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message);
});

socket.on('connect', () => {
  console.log('Connected to server');
  
  // 1. Start AI game
  socket.emit('start_ai_game', {
    userId,
    difficulty: 5,
    timeControlSec: 600,
    incrementSec: 0
  });
});

socket.on('match_found', (data) => {
  console.log('Match found:', data);
  gameId = data.gameId;
  
  // 2. Join game room
  socket.emit('join_game_room', { gameId, userId });
});

socket.on('game_state_sync', (data) => {
  console.log('Game state sync received:', data.fen);
  
  // 3. Make move
  setTimeout(() => {
    console.log('Sending make_move e2e4');
    socket.emit('make_move', {
      gameId,
      userId,
      move: 'e4'
    });
  }, 500);
});

socket.on('move_confirmed', (data) => {
  console.log('Move confirmed:', data.move.san);
});

socket.on('ai_moved', (data) => {
  console.log('AI moved:', data.move.san);
  console.log('Test successful!');
  process.exit(0);
});

socket.on('error', (err) => {
  console.error('Socket error:', err);
});

setTimeout(() => {
  console.error('Test timed out!');
  process.exit(1);
}, 10000);
