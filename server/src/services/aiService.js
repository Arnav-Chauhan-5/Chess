const { Worker } = require('worker_threads');
const path = require('path');
const { Chess } = require('chess.js');

class AIService {
  constructor() {
    this.engines = new Map(); // gameId -> { worker, handlers }
  }

  getEngineWorker(gameId) {
    if (!this.engines.has(gameId)) {
      const worker = new Worker(path.join(__dirname, 'stockfishWorker.js'));
      const handlers = new Set();
      
      worker.on('message', (msg) => {
        if (msg === 'ready') {
          worker.postMessage('uci');
          worker.postMessage('setoption name Threads value 1');
          worker.postMessage('setoption name Hash value 16');
        } else {
          for (const handler of handlers) {
            handler(msg);
          }
        }
      });
      
      worker.on('error', (err) => console.error(`Worker error for game ${gameId}:`, err));
      worker.on('exit', (code) => {
        if (code !== 0) console.error(`Worker stopped with exit code ${code} for game ${gameId}`);
        this.engines.delete(gameId);
      });

      this.engines.set(gameId, { worker, handlers });
    }
    return this.engines.get(gameId);
  }

  cleanupEngine(gameId) {
    if (this.engines.has(gameId)) {
      const { worker } = this.engines.get(gameId);
      worker.postMessage('quit');
      this.engines.delete(gameId);
      console.log(`[aiService] Cleaned up engine for game ${gameId}`);
    }
  }

  async getBestMove(gameId, fen, difficulty = 5) {
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

        const engineData = this.getEngineWorker(gameId);
        const onMessage = (msg) => {
          if (typeof msg === 'string' && msg.startsWith('bestmove')) {
            const move = msg.split(' ')[1];
            engineData.handlers.delete(onMessage);
            resolve(move);
          }
        };
        
        engineData.handlers.add(onMessage);

        engineData.worker.postMessage('setoption name UCI_LimitStrength value false');
        engineData.worker.postMessage(`position fen ${fen}`);
        engineData.worker.postMessage(`go depth ${depth}`);
        
        setTimeout(() => {
          engineData.handlers.delete(onMessage);
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

        const engineData = this.getEngineWorker(gameId);
        const onMessage = (msg) => {
          if (typeof msg === 'string' && msg.startsWith('bestmove')) {
            const move = msg.split(' ')[1];
            engineData.handlers.delete(onMessage);
            resolve(move);
          }
        };
        
        engineData.handlers.add(onMessage);

        engineData.worker.postMessage('setoption name UCI_LimitStrength value true');
        engineData.worker.postMessage(`setoption name UCI_Elo value ${targetElo}`);
        engineData.worker.postMessage(`position fen ${fen}`);
        engineData.worker.postMessage('go movetime 500');
        
        setTimeout(() => {
          engineData.handlers.delete(onMessage);
          reject(new Error('AI timeout'));
        }, 5000);
      }
    });
  }
}

module.exports = new AIService();
