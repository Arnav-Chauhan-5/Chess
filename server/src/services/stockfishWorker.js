const { parentPort } = require('worker_threads');
const stockfish = require('stockfish');

(async () => {
  try {
    const sf = await stockfish('lite-single');
    const send = sf.sendCommand || sf.postMessage;
    
    // Intercept stockfish's output which defaults to console.log in Node.js
    const origLog = console.log;
    console.log = (...args) => {
      const msg = args.join(' ');
      
      // Route potential stockfish messages back to the parent
      if (typeof msg === 'string' && (msg.startsWith('bestmove') || msg.startsWith('info') || msg.startsWith('id') || msg.startsWith('option') || msg.startsWith('uci') || msg.startsWith('Stockfish'))) {
        parentPort.postMessage(msg);
        return;
      }
      
      origLog(...args);
    };
    
    parentPort.on('message', (msg) => {
      if (msg === 'quit') {
        send.call(sf, 'quit');
        process.exit(0);
      } else {
        send.call(sf, msg);
      }
    });

    parentPort.postMessage('ready');
  } catch (e) {
    console.error("Worker failed to initialize Stockfish:", e);
    process.exit(1);
  }
})();
