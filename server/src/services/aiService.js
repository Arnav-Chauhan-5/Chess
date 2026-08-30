const stockfish = require('stockfish');
const { Chess } = require('chess.js');
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
      const isSub1320 = difficulty <= 3;

      if (isSub1320) {
        let randomProb = 0;
        let depth = 1;
        if (difficulty === 1) { randomProb = 0.30; depth = 2; }
        else if (difficulty === 2) { randomProb = 0.15; depth = 3; }
        else if (difficulty === 3) { randomProb = 0.05; depth = 5; }

        if (Math.random() < randomProb) {
          try {
            const chess = new Chess(fen);
            const moves = chess.moves({ verbose: true });
            if (moves.length > 0) {
              const randomMoveObj = moves[Math.floor(Math.random() * moves.length)];
              const moveStr = randomMoveObj.from + randomMoveObj.to + (randomMoveObj.promotion || '');
              return resolve(moveStr);
            }
          } catch (e) {
            console.warn("Failed random move fallback", e);
          }
        }

        const onMessage = (msg) => {
          if (typeof msg === 'string' && msg.startsWith('bestmove')) {
            const move = msg.split(' ')[1];
            this.messageHandlers.delete(onMessage);
            resolve(move);
          }
        };
        
        this.messageHandlers.add(onMessage);

        const send = this.engine.sendCommand || this.engine.postMessage;
        send.call(this.engine, 'setoption name UCI_LimitStrength value false');
        send.call(this.engine, `position fen ${fen}`);
        send.call(this.engine, `go depth ${depth}`);
        
        setTimeout(() => {
          this.messageHandlers.delete(onMessage);
          reject(new Error('AI timeout'));
        }, 5000);

      } else {
        const difficultyToElo = {
          4: 1320,
          5: 1600,
          6: 1900,
          7: 2200,
          8: 2450,
          9: 2650,
          10: 2850
        };
        const targetElo = difficultyToElo[difficulty] || 2850;

        const onMessage = (msg) => {
          if (typeof msg === 'string' && msg.startsWith('bestmove')) {
            const move = msg.split(' ')[1];
            this.messageHandlers.delete(onMessage);
            resolve(move);
          }
        };
        
        this.messageHandlers.add(onMessage);

        const send = this.engine.sendCommand || this.engine.postMessage;
        send.call(this.engine, 'setoption name UCI_LimitStrength value true');
        send.call(this.engine, `setoption name UCI_Elo value ${targetElo}`);
        send.call(this.engine, `position fen ${fen}`);
        send.call(this.engine, 'go movetime 500');
        
        setTimeout(() => {
          this.messageHandlers.delete(onMessage);
          reject(new Error('AI timeout'));
        }, 5000);
      }
    });
  }
}

module.exports = new AIService();
