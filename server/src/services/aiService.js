const stockfish = require('stockfish');

class AIService {
  constructor() {
    this.engine = null;
    this.isReady = false;
    this.initEngine();
  }

  async initEngine() {
    try {
      const sf = await stockfish();
      this.engine = sf;
      
      this.engine.onmessage = (msg) => {
        // Internal handler if needed
      };
      
      if (typeof this.engine.postMessage === 'function') {
        this.engine.postMessage('uci');
      }
    } catch (e) {
      console.warn("Failed to initialize Stockfish:", e.message);
    }
  }

  async getBestMove(fen, difficulty = 5) {
    if (!this.engine) throw new Error('AI not ready');
    return new Promise((resolve, reject) => {
      const depth = Math.max(1, Math.min(difficulty * 2, 20)); // Map difficulty 1-10 to depth 2-20
      
      const onMessage = (msg) => {
        if (typeof msg === 'string' && msg.startsWith('bestmove')) {
          const move = msg.split(' ')[1];
          this.engine.removeListener('message', onMessage); // Cleanup
          resolve(move);
        }
      };
      
      // We must hack around stockfish npm package event listener if it doesn't extend EventEmitter.
      // Usually it's just `onmessage = fn`. To support concurrent requests, a queue is better, but MVP:
      const originalOnMessage = this.engine.onmessage;
      this.engine.onmessage = (msg) => {
        if (originalOnMessage) originalOnMessage(msg);
        onMessage(msg);
      };

      this.engine.postMessage(`position fen ${fen}`);
      this.engine.postMessage(`go depth ${depth}`);
      
      // Timeout fallback
      setTimeout(() => {
        reject(new Error('AI timeout'));
      }, 5000);
    });
  }
}

module.exports = new AIService();
