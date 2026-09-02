const { Worker, parentPort } = require('worker_threads');
if (!require('worker_threads').isMainThread) {
  const wt = require('worker_threads');
  const origIsMainThread = wt.isMainThread;
  Object.defineProperty(wt, 'isMainThread', { value: true, configurable: true });
  const stockfish = require('stockfish');
  Object.defineProperty(wt, 'isMainThread', { value: origIsMainThread, configurable: true });
  
  (async () => {
    const sf = await stockfish('lite-single');
    const send = sf.sendCommand || sf.postMessage;
    
    // Intercept stockfish's output which defaults to console.log in Node.js
    const origLog = console.log;
    console.log = (...args) => {
      const msg = args.join(' ');
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
  })();
} else {
  const w = new Worker(__filename);
  w.on('message', console.log);
  w.postMessage('uci');
  setTimeout(() => { w.postMessage('quit'); }, 1000);
}
