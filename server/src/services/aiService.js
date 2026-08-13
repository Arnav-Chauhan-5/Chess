const stockfish = require('stockfish');

class AIService {
  constructor() {
    this.engine = null;
    this.isReady = false;
    this.messageHandlers = new Set();
    this.initEngine();
  }

  async initEngine() {
    try {
      const sf = await stockfish();
      this.engine = sf;
      
      // Intercept stockfish's output which defaults to console.log in Node.js
      const origLog = console.log;
      console.log = (...args) => {
        const msg = args.join(' ');
        
        // Route potential stockfish messages to our handlers
        if (typeof msg === 'string' && (msg.startsWith('bestmove') || msg.startsWith('info') || msg.startsWith('id') || msg.startsWith('option') || msg.startsWith('uci') || msg.startsWith('Stockfish'))) {
          for (const handler of this.messageHandlers) {
            handler(msg);
          }
          // Suppress raw stockfish chatter from the terminal
          return;
        }
        
        origLog(...args);
      };
      
      const send = this.engine.sendCommand || this.engine.postMessage;
      if (typeof send === 'function') {
        send.call(this.engine, 'uci');
      }
    } catch (e) {
      console.warn("Failed to initialize Stockfish:", e.message);
    }
  }

  async getBestMove(fen, difficulty = 5) {
    if (!this.engine) throw new Error('AI not ready');
    return new Promise((resolve, reject) => {
      // difficulty comes in as 1 to 10. Map it to Skill Level 0 to 20
      const skillLevel = Math.round((difficulty - 1) * (20 / 9));
      // Also scale depth so lower difficulties don't think too deeply
      const depth = Math.max(1, Math.min(difficulty * 2, 20)); 
      
      const onMessage = (msg) => {
        if (typeof msg === 'string' && msg.startsWith('bestmove')) {
          const move = msg.split(' ')[1];
          this.messageHandlers.delete(onMessage); // Cleanup
          resolve(move);
        }
      };
      
      this.messageHandlers.add(onMessage);

      const send = this.engine.sendCommand || this.engine.postMessage;
      // Set the skill level option
      send.call(this.engine, `setoption name Skill Level value ${skillLevel}`);
      send.call(this.engine, `position fen ${fen}`);
      send.call(this.engine, `go depth ${depth}`);
      
      // Timeout fallback
      setTimeout(() => {
        this.messageHandlers.delete(onMessage);
        reject(new Error('AI timeout'));
      }, 5000);
    });
  }
}

module.exports = new AIService();
