import React, { useState, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { RotateCcw } from 'lucide-react';

const dotStyle = {
  backgroundImage: 'radial-gradient(circle, rgba(0,0,0,.2) 25%, transparent 25%)',
  borderRadius: '50%'
};

const captureStyle = {
  backgroundImage: 'radial-gradient(circle, transparent 75%, rgba(0,0,0,.2) 75%)',
  borderRadius: '50%'
};

const activeStyle = {
  backgroundColor: 'rgba(255, 255, 0, 0.4)'
};

const RULES_CONTENT = [
  {
    id: 'overview',
    title: 'Overview',
    description: 'The objective of chess is to checkmate your opponent\'s king. A game can also end in a draw.',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    highlights: {}
  },
  {
    id: 'setup',
    title: 'The Board & Setup',
    description: 'The board consists of 64 squares in an 8x8 grid. Rows are called "ranks" (1-8), and columns are called "files" (a-h). White always moves first.',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    highlights: {}
  },
  {
    id: 'pawn',
    title: 'Pieces: Pawn',
    description: 'Pawns move forward exactly one square, but capture diagonally. On their very first move, they have the option to advance two squares.',
    fen: '8/8/8/8/8/8/P7/8 w - - 0 1',
    highlights: {
      a2: activeStyle,
      a3: dotStyle,
      a4: dotStyle,
    }
  },
  {
    id: 'knight',
    title: 'Pieces: Knight',
    description: 'Knights move in an L-shape (two squares in one direction, one in a perpendicular direction). They are the only pieces that can jump over others.',
    fen: '8/8/8/8/4N3/8/8/8 w - - 0 1',
    highlights: {
      e4: activeStyle,
      d6: dotStyle, f6: dotStyle,
      c5: dotStyle, g5: dotStyle,
      c3: dotStyle, g3: dotStyle,
      d2: dotStyle, f2: dotStyle
    }
  },
  {
    id: 'bishop',
    title: 'Pieces: Bishop',
    description: 'Bishops move any number of vacant squares diagonally.',
    fen: '8/8/8/8/4B3/8/8/8 w - - 0 1',
    highlights: {
      e4: activeStyle,
      d5: dotStyle, c6: dotStyle, b7: dotStyle, a8: dotStyle,
      f5: dotStyle, g6: dotStyle, h7: dotStyle,
      d3: dotStyle, c2: dotStyle, b1: dotStyle,
      f3: dotStyle, g2: dotStyle, h1: dotStyle
    }
  },
  {
    id: 'rook',
    title: 'Pieces: Rook',
    description: 'Rooks move any number of vacant squares horizontally or vertically.',
    fen: '8/8/8/8/4R3/8/8/8 w - - 0 1',
    highlights: {
      e4: activeStyle,
      e5: dotStyle, e6: dotStyle, e7: dotStyle, e8: dotStyle,
      e3: dotStyle, e2: dotStyle, e1: dotStyle,
      a4: dotStyle, b4: dotStyle, c4: dotStyle, d4: dotStyle,
      f4: dotStyle, g4: dotStyle, h4: dotStyle
    }
  },
  {
    id: 'queen',
    title: 'Pieces: Queen',
    description: 'The Queen is the most powerful piece. It moves any number of vacant squares horizontally, vertically, or diagonally.',
    fen: '8/8/8/8/4Q3/8/8/8 w - - 0 1',
    highlights: {
      e4: activeStyle,
      d5: dotStyle, f5: dotStyle, d3: dotStyle, f3: dotStyle,
      e5: dotStyle, e3: dotStyle, d4: dotStyle, f4: dotStyle
    }
  },
  {
    id: 'king',
    title: 'Pieces: King',
    description: 'The King moves exactly one square horizontally, vertically, or diagonally. If the King is trapped, the game is over.',
    fen: '8/8/8/8/4K3/8/8/8 w - - 0 1',
    highlights: {
      e4: activeStyle,
      d5: dotStyle, e5: dotStyle, f5: dotStyle,
      d4: dotStyle, f4: dotStyle,
      d3: dotStyle, e3: dotStyle, f3: dotStyle
    }
  },
  {
    id: 'castling',
    title: 'Special Moves: Castling',
    description: 'Castling moves the king two squares towards a rook, and the rook jumps over the king. It requires that neither piece has moved, and the path is clear.',
    fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
    afterFen: 'r3k2r/8/8/8/8/8/8/R4RK1 w kq - 1 1',
    highlights: {
      e1: activeStyle,
      g1: dotStyle
    }
  },
  {
    id: 'en-passant',
    title: 'Special Moves: En Passant',
    description: 'If a pawn advances two squares past an opponent\'s pawn, the opponent can capture it "in passing" on the very next turn.',
    fen: '8/8/8/3pP3/8/8/8/8 w - d6 0 2',
    afterFen: '8/8/3P4/8/8/8/8/8 b - - 0 2',
    highlights: {
      e5: activeStyle,
      d6: captureStyle
    }
  },
  {
    id: 'promotion',
    title: 'Special Moves: Promotion',
    description: 'When a pawn reaches the opposite end of the board, it must be promoted to a queen, rook, bishop, or knight.',
    fen: '8/4P3/8/8/8/8/8/8 w - - 0 1',
    afterFen: '4Q3/8/8/8/8/8/8/8 b - - 0 1',
    highlights: {
      e7: activeStyle,
      e8: dotStyle
    }
  },
  {
    id: 'checkmate',
    title: 'Check & Checkmate',
    description: 'When a king is attacked, it is in "check". If there is no legal move to escape check, it is "checkmate" and the game ends.',
    fen: 'k7/8/1Q6/8/8/8/8/7K w - - 0 1',
    afterFen: 'kQ6/8/8/8/8/8/8/7K b - - 0 1',
    highlights: {
      a8: { backgroundColor: 'rgba(239, 68, 68, 0.8)' }
    }
  },
  {
    id: 'stalemate',
    title: 'Stalemate',
    description: 'If it is a player\'s turn to move, their king is NOT in check, and they have no legal moves, the game is a "stalemate" (a draw).',
    fen: 'k7/2Q5/8/8/8/8/8/7K b - - 0 1',
    highlights: {
      a8: activeStyle
    }
  },
  {
    id: 'opening-italian',
    title: 'Openings: Italian Game',
    description: '1. e4 e5 2. Nf3 Nc6 3. Bc4\n\nThe Italian Game focuses on rapid development and controlling the center, while eyeing Black\'s vulnerable f7 square.',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    highlights: {}
  },
  {
    id: 'opening-ruy-lopez',
    title: 'Openings: Ruy Lopez',
    description: '1. e4 e5 2. Nf3 Nc6 3. Bb5\n\nAlso known as the Spanish Opening, it applies early pressure to the knight defending the center.',
    fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    highlights: {}
  },
  {
    id: 'opening-sicilian',
    title: 'Openings: Sicilian Defense',
    description: '1. e4 c5\n\nBlack fights for the center asymmetrically, creating unbalanced and highly tactical positions.',
    fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    highlights: {}
  },
  {
    id: 'opening-french',
    title: 'Openings: French Defense',
    description: '1. e4 e6\n\nA solid, resilient setup for Black that usually leads to a closed center and strategic maneuvering.',
    fen: 'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    highlights: {}
  },
  {
    id: 'opening-queens-gambit',
    title: "Openings: Queen's Gambit",
    description: '1. d4 d5 2. c4\n\nWhite temporarily sacrifices a wing pawn to gain control of the center and rapid piece activity.',
    fen: 'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2',
    highlights: {}
  },
  {
    id: 'opening-kings-indian',
    title: "Openings: King's Indian Defense",
    description: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6\n\nBlack allows White to build a massive pawn center, planning to counterattack it later from the flanks.',
    fen: 'rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 5',
    highlights: {}
  }
];

function RuleBoard({ rule }) {
  const [fen, setFen] = useState(rule.fen);
  const [isVisible, setIsVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const containerRef = useRef(null);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mediaQuery.matches);
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setIsVisible(true);
      }
    }, { threshold: 0.5 });
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isVisible && rule.afterFen) {
      if (reduceMotion) {
        setFen(rule.afterFen);
      } else {
        const timer = setTimeout(() => {
          setFen(rule.afterFen);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [isVisible, rule.afterFen, reduceMotion]);

  const handleReplay = () => {
    setFen(rule.fen);
    if (!reduceMotion && rule.afterFen) {
      setTimeout(() => setFen(rule.afterFen), 600);
    }
  };

  // Add pulse animation to highlighted squares if visible
  const animatedHighlights = {};
  for (const [sq, style] of Object.entries(rule.highlights)) {
    animatedHighlights[sq] = {
      ...style,
      animation: isVisible && !reduceMotion ? 'pulse 1.5s infinite' : 'none'
    };
  }

  return (
    <div ref={containerRef} style={{ width: '280px', flexShrink: 0, position: 'relative' }}>
      <div style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '2px solid rgba(255,255,255,0.08)' }}>
        <Chessboard 
          options={{
            position: fen,
            squareStyles: animatedHighlights,
            allowDragging: false,
            showNotation: true,
            boardOrientation: 'white',
            darkSquareStyle: { backgroundColor: '#475569' },
            lightSquareStyle: { backgroundColor: '#cbd5e1' },
            animationDuration: reduceMotion ? 0 : 300
          }}
        />
      </div>
      {rule.afterFen && (
        <button 
          onClick={handleReplay} 
          className="btn" 
          style={{ position: 'absolute', bottom: '-40px', right: 0, padding: '0.25rem 0.75rem', height: '32px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)' }}
        >
          <RotateCcw size={14} style={{ marginRight: '4px' }} /> Replay
        </button>
      )}
    </div>
  );
}

export default function Rules() {
  return (
    <div style={{ display: 'flex', gap: '2rem', maxWidth: '1200px', margin: '0 auto', padding: '2rem', width: '100%' }}>
      
      {/* Sidebar Nav */}
      <div style={{ width: '240px', flexShrink: 0 }}>
        <div className="glass-panel" style={{ position: 'sticky', top: '90px', padding: '1.5rem 1rem' }}>
          <h3 style={{ marginBottom: '1rem', paddingLeft: '0.5rem' }}>Sections</h3>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {RULES_CONTENT.map((rule, index) => (
              <a 
                key={`nav-${rule.id}`} 
                href={`#${rule.id}`}
                style={{ 
                  color: 'var(--text-secondary)', 
                  textDecoration: 'none',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                {index + 1}. {rule.title}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>How to Play Chess</h1>
        
        {RULES_CONTENT.map((rule, index) => (
          <div key={rule.id} id={rule.id} className="glass-panel" style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ color: 'var(--accent-color)', marginBottom: '1rem' }}>{index + 1}. {rule.title}</h2>
              <p style={{ fontSize: '1.1rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{rule.description}</p>
            </div>
            
            <RuleBoard rule={rule} />
          </div>
        ))}
        
      </div>
      
      {/* Inline styles for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
