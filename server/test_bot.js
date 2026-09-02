const aiService = require('./src/services/aiService');

(async () => {
  try {
    console.log('Testing bot move...');
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Initial position
    const move = await aiService.getBestMove('test-game', fen, 5);
    console.log('Bot move:', move);
    const mem = process.memoryUsage();
    console.log(`Memory Usage: rss=${Math.round(mem.rss / 1024 / 1024)}MB, heapTotal=${Math.round(mem.heapTotal / 1024 / 1024)}MB, heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB`);
    aiService.cleanupEngine('test-game');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
