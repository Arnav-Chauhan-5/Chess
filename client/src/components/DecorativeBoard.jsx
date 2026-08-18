import { useEffect, useState, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

// The "Immortal Game" — Anderssen vs Kieseritzky, 1851 (shortened)
const DEMO_MOVES = [
  'e4','e5','f4','exf4','Bc4','Qh4+','Kf1','b5','Bxb5','Nf6','Nf3','Qh6',
  'd3','Nh5','Nh4','Qg5','Nf5','c6','g4','Nf6','Rg1','cxb5','h4','Qg5',
  'h5','Qg5','Qf3','Ng8','Bxf4','Qf6','Nc3','Bc5','Nd5'
];

/**
 * A non-interactive decorative chessboard.
 * - If `autoplay` is true (default), it auto-plays through the Immortal Game on a loop.
 * - If `autoplay` is false, it shows the standard starting position statically.
 */
export default function DecorativeBoard({ autoplay = true }) {
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const moveIndexRef = useRef(0);

  useEffect(() => {
    if (!autoplay) return;

    const interval = setInterval(() => {
      const chess = chessRef.current;
      const idx = moveIndexRef.current;

      if (idx >= DEMO_MOVES.length) {
        chess.reset();
        moveIndexRef.current = 0;
        setFen(chess.fen());
        return;
      }

      try {
        chess.move(DEMO_MOVES[idx]);
        setFen(chess.fen());
        moveIndexRef.current = idx + 1;
      } catch {
        chess.reset();
        moveIndexRef.current = 0;
        setFen(chess.fen());
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [autoplay]);

  return (
    <div style={{
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 80px rgba(59, 130, 246, 0.15)',
      border: '2px solid rgba(255,255,255,0.08)',
      width: '100%',
      maxWidth: '480px'
    }}>
      <Chessboard options={{
        position: fen,
        allowDragging: false,
        darkSquareStyle: { backgroundColor: '#475569' },
        lightSquareStyle: { backgroundColor: '#cbd5e1' },
        animationDuration: autoplay ? 300 : 0
      }} />
    </div>
  );
}
