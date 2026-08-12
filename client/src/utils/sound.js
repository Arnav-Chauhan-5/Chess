// Web Audio API based sound generator for chess moves
let audioCtx = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

const playOscillator = (freq, type, duration, vol) => {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  // Optional envelope to avoid clicks
  osc.frequency.exponentialRampToValueAtTime(freq * 0.9, audioCtx.currentTime + duration);

  gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
};

export const playSound = (type) => {
  const enabled = localStorage.getItem('chess_sounds_enabled') !== 'false';
  if (!enabled) return;
  
  try {
    initAudio();
    switch (type) {
      case 'move':
        playOscillator(300, 'sine', 0.1, 0.3);
        break;
      case 'capture':
        playOscillator(200, 'triangle', 0.15, 0.4);
        setTimeout(() => playOscillator(300, 'triangle', 0.1, 0.2), 50);
        break;
      case 'check':
        playOscillator(400, 'square', 0.3, 0.2);
        setTimeout(() => playOscillator(600, 'sine', 0.4, 0.3), 100);
        break;
      case 'end':
        playOscillator(300, 'sine', 0.3, 0.3);
        setTimeout(() => playOscillator(400, 'sine', 0.3, 0.3), 150);
        setTimeout(() => playOscillator(500, 'sine', 0.6, 0.4), 300);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error('Audio play failed:', e);
  }
};
