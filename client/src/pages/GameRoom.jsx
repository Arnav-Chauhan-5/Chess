import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { playSound } from '../utils/sound';
import { getOpeningName } from '../utils/openings';

// Piece unicode symbols for the promotion picker
const PROMOTION_PIECES = {
  w: { q: '♕', r: '♖', b: '♗', n: '♘' },
  b: { q: '♛', r: '♜', b: '♝', n: '♞' }
};

const PIECE_SYMBOLS = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' }
};

export default function GameRoom() {
  const { gameId } = useParams();
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Use a ref for the mutable Chess instance so it persists across renders
  const gameRef = useRef(new Chess());
  // FEN string state drives the <Chessboard position={...}> prop
  const [fen, setFen] = useState(gameRef.current.fen());
  const [playerColor, setPlayerColor] = useState('w');
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState('');
  const [drawOffer, setDrawOffer] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [optionSquares, setOptionSquares] = useState({});
  const movesEndRef = useRef(null);

  // Fix 1: Promotion picker state
  const [pendingPromotion, setPendingPromotion] = useState(null);
  // Fix 2: Opponent disconnect banner
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  // Fix 3: Resign confirmation
  const [showResignConfirm, setShowResignConfirm] = useState(false);

  // Rematch, Takeback, Rating, PGN
  const [isCasual, setIsCasual] = useState(true);
  const [whiteRatingDelta, setWhiteRatingDelta] = useState(null);
  const [blackRatingDelta, setBlackRatingDelta] = useState(null);
  const [pgn, setPgn] = useState('');
  const [showRematchPrompt, setShowRematchPrompt] = useState(false);
  const [showTakebackPrompt, setShowTakebackPrompt] = useState(false);

  useEffect(() => {
    if (!socket || !user) return;

    socket.emit('join_game_room', { gameId, userId: user.id });

    socket.on('game_state_sync', (data) => {
      gameRef.current = new Chess(data.fen);
      setFen(data.fen);
      setWhiteTime(data.whiteTimeLeftMs);
      setBlackTime(data.blackTimeLeftMs);
      
      if (data.whiteId === user.id) setPlayerColor('w');
      else if (data.blackId === user.id) setPlayerColor('b');
      else setPlayerColor('viewer');
      setIsCasual(data.isCasual ?? true);
    });

    socket.on('opponent_moved', (data) => {
      gameRef.current.move(data.move);
      setFen(gameRef.current.fen());
      setWhiteTime(data.whiteTimeLeftMs);
      setBlackTime(data.blackTimeLeftMs);
    });

    socket.on('ai_moved', (data) => {
      gameRef.current.move(data.move);
      setFen(gameRef.current.fen());
      setWhiteTime(data.whiteTimeLeftMs);
      setBlackTime(data.blackTimeLeftMs);
    });

    socket.on('move_confirmed', (data) => {
      setWhiteTime(data.whiteTimeLeftMs);
      setBlackTime(data.blackTimeLeftMs);
    });

    socket.on('game_over', (data) => {
      setIsGameOver(true);
      setGameOverReason(`${data.status}: ${data.reason}`);
      setWhiteRatingDelta(data.whiteRatingDelta ?? null);
      setBlackRatingDelta(data.blackRatingDelta ?? null);
      setPgn(data.pgn || '');
    });

    socket.on('rematch_requested', () => setShowRematchPrompt(true));
    socket.on('rematch_declined', () => setShowRematchPrompt(false));
    socket.on('game_started', (data) => {
      setShowRematchPrompt(false);
      navigate(`/game/${data.gameId}`);
      window.location.reload();
    });

    socket.on('takeback_requested', () => setShowTakebackPrompt(true));
    socket.on('takeback_declined', () => setShowTakebackPrompt(false));
    socket.on('takeback_accepted', (data) => {
      setShowTakebackPrompt(false);
      gameRef.current = new Chess(data.fen);
      setFen(data.fen);
      setWhiteTime(data.whiteTimeLeftMs);
      setBlackTime(data.blackTimeLeftMs);
    });
    
    socket.on('receive_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('draw_offered', () => {
      setDrawOffer(true);
    });

    socket.on('draw_declined', () => {
      // Future: could show a toast here
    });

    // Fix 2: Opponent disconnect / reconnect events
    socket.on('opponent_disconnected', () => {
      setOpponentDisconnected(true);
    });

    socket.on('opponent_reconnected', () => {
      setOpponentDisconnected(false);
    });

    return () => {
      socket.off('game_state_sync');
      socket.off('opponent_moved');
      socket.off('ai_moved');
      socket.off('move_confirmed');
      socket.off('game_over');
      socket.off('receive_message');
      socket.off('draw_offered');
      socket.off('draw_declined');
      socket.off('opponent_disconnected');
      socket.off('opponent_reconnected');
      socket.off('rematch_requested');
      socket.off('rematch_declined');
      socket.off('game_started');
      socket.off('takeback_requested');
      socket.off('takeback_declined');
      socket.off('takeback_accepted');
    };
  }, [socket, gameId, user]);

  // Very basic clock tick effect
  useEffect(() => {
    if (isGameOver) return;
    const interval = setInterval(() => {
      if (gameRef.current.turn() === 'w') {
        setWhiteTime(t => Math.max(0, t - 100));
      } else {
        setBlackTime(t => Math.max(0, t - 100));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [fen, isGameOver]);

  const prevHistoryLengthRef = useRef(0);

  const { history, movePairs, capturedByWhite, capturedByBlack, whiteMaterial, blackMaterial, dynamicSquareStyles, openingName } = useMemo(() => {
    const chess = gameRef.current;
    const hist = chess.history({ verbose: true });
    
    // Captures
    const capW = [];
    const capB = [];
    hist.forEach(m => {
      if (m.captured) {
        if (m.color === 'w') capW.push(m.captured);
        else capB.push(m.captured);
      }
    });

    // Material count
    let wMat = 0;
    let bMat = 0;
    const VALS = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    chess.board().forEach(row => {
      row.forEach(p => {
        if (p) {
          if (p.color === 'w') wMat += VALS[p.type];
          if (p.color === 'b') bMat += VALS[p.type];
        }
      });
    });

    // Move pairs for history panel
    const pairs = [];
    for (let i = 0; i < hist.length; i += 2) {
      pairs.push({ w: hist[i].san, b: hist[i+1]?.san || '' });
    }

    // Highlighting
    const styles = { ...optionSquares };
    if (hist.length > 0) {
      const lastMove = hist[hist.length - 1];
      styles[lastMove.from] = { ...(styles[lastMove.from] || {}), backgroundColor: 'rgba(155, 199, 0, 0.41)' };
      styles[lastMove.to] = { ...(styles[lastMove.to] || {}), backgroundColor: 'rgba(155, 199, 0, 0.41)' };
    }
    
    // Check highlight
    if (chess.inCheck()) {
      const turn = chess.turn();
      const board = chess.board();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece && piece.type === 'k' && piece.color === turn) {
            const square = 'abcdefgh'[c] + (8 - r);
            styles[square] = { ...(styles[square] || {}), backgroundColor: 'rgba(239, 68, 68, 0.8)' };
          }
        }
      }
    }

    return {
      history: hist,
      movePairs: pairs,
      capturedByWhite: capW,
      capturedByBlack: capB,
      whiteMaterial: wMat,
      blackMaterial: bMat,
      dynamicSquareStyles: styles,
      openingName: getOpeningName(hist)
    };
  }, [fen, optionSquares]);

  useEffect(() => {
    if (history.length > prevHistoryLengthRef.current) {
      // Play sound for the new move (unless we just loaded a game with lots of moves)
      if (history.length === prevHistoryLengthRef.current + 1 || prevHistoryLengthRef.current > 0) {
        const lastMove = history[history.length - 1];
        if (gameRef.current.isGameOver()) {
          playSound('end');
        } else if (gameRef.current.inCheck()) {
          playSound('check');
        } else if (lastMove.captured) {
          playSound('capture');
        } else {
          playSound('move');
        }
      }
    }
    prevHistoryLengthRef.current = history.length;
    movesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history.length]);

  const opponentCaptures = playerColor === 'w' ? capturedByBlack : capturedByWhite;
  const myCaptures = playerColor === 'w' ? capturedByWhite : capturedByBlack;
  
  const whiteAdvantage = Math.max(0, whiteMaterial - blackMaterial);
  const blackAdvantage = Math.max(0, blackMaterial - whiteMaterial);
  const opponentAdvantage = playerColor === 'w' ? blackAdvantage : whiteAdvantage;
  const myAdvantage = playerColor === 'w' ? whiteAdvantage : blackAdvantage;

  const renderCaptures = (pieces, colorStr) => {
    if (!pieces || pieces.length === 0) return null;
    const order = { p: 1, n: 2, b: 3, r: 4, q: 5 };
    const sorted = [...pieces].sort((a, b) => order[a] - order[b]);
    return (
      <div style={{ display: 'flex', gap: '2px', fontSize: '1.2rem', color: colorStr === 'w' ? '#fff' : '#000', textShadow: '0 0 2px rgba(255,255,255,0.5)' }}>
        {sorted.map((p, i) => <span key={i}>{PIECE_SYMBOLS[colorStr][p]}</span>)}
      </div>
    );
  };

  const getMoveOptions = useCallback((square) => {
    const chess = gameRef.current;
    
    if (chess.turn() !== playerColor) {
      setOptionSquares({});
      return;
    }
    
    const piece = chess.get(square);
    if (!piece || piece.color !== playerColor) {
      setOptionSquares({});
      return;
    }

    const moves = chess.moves({
      square,
      verbose: true
    });
    
    if (moves.length === 0) {
      setOptionSquares({});
      return;
    }

    const newSquares = {};
    moves.forEach((move) => {
      const isCapture = chess.get(move.to) !== null;
      newSquares[move.to] = {
        backgroundImage: isCapture
          ? 'radial-gradient(circle, transparent 75%, rgba(0,0,0,.2) 75%)'
          : 'radial-gradient(circle, rgba(0,0,0,.2) 25%, transparent 25%)',
        borderRadius: '50%'
      };
    });
    
    newSquares[square] = {
      backgroundColor: 'rgba(255, 255, 0, 0.4)'
    };
    
    setOptionSquares(newSquares);
  }, [playerColor]);

  const onPieceDrag = useCallback(({ square }) => {
    if (playerColor === 'viewer') return;
    getMoveOptions(square);
  }, [getMoveOptions, playerColor]);

  const onSquareClick = useCallback(({ square }) => {
    if (playerColor === 'viewer') return;
    // If promotion picker is open, clicking elsewhere cancels it
    if (pendingPromotion) {
      setPendingPromotion(null);
      return;
    }
    getMoveOptions(square);
  }, [getMoveOptions, pendingPromotion, playerColor]);

  const onPieceDragCancel = useCallback(() => {
    setOptionSquares({});
  }, []);

  // Executes the actual move (used by onDrop for non-promotion and by promotion picker callback)
  const executeMove = useCallback((from, to, promotion) => {
    const chess = gameRef.current;
    try {
      const moveObj = { from, to };
      if (promotion) moveObj.promotion = promotion;

      const move = chess.move(moveObj);
      if (move === null) return false;

      setFen(chess.fen());
      
      socket.emit('make_move', {
        gameId,
        userId: user?.id,
        move: move.san
      });

      return true;
    } catch (e) {
      console.error('Move error:', e);
      return false;
    }
  }, [socket, gameId, user]);

  // react-chessboard v5 calls onPieceDrop with a SINGLE OBJECT arg:
  //   { piece, sourceSquare, targetSquare }
  const onDrop = useCallback(({ sourceSquare, targetSquare }) => {
    setOptionSquares({});
    if (isGameOver) return false;
    
    const chess = gameRef.current;
    if (chess.turn() !== playerColor) return false;

    // Fix 1: Detect promotion before making the move
    const piece = chess.get(sourceSquare);
    const isPromotion = piece && piece.type === 'p' && 
      (targetSquare.endsWith('8') || targetSquare.endsWith('1'));

    if (isPromotion) {
      // Don't move yet — show the promotion picker
      setPendingPromotion({ from: sourceSquare, to: targetSquare });
      return false; // Let the piece snap back; we'll update the board after selection
    }

    return executeMove(sourceSquare, targetSquare);
  }, [isGameOver, playerColor, executeMove]);

  const handlePromotionChoice = useCallback((promotionPiece) => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    executeMove(from, to, promotionPiece);
  }, [pendingPromotion, executeMove]);

  const cancelPromotion = useCallback(() => {
    setPendingPromotion(null);
  }, []);

  // Fix 3: Resign with confirmation
  const handleResign = useCallback(() => {
    socket.emit('resign', { gameId, userId: user?.id });
    setShowResignConfirm(false);
  }, [socket, gameId, user]);

  const formatTime = (ms) => {
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    socket.emit('send_message', { gameId, text: chatInput.trim(), username: user?.username || 'Guest' });
    setChatInput('');
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      {/* Board Area */}
      <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Opponent Info */}
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 'bold' }}>Opponent</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Rating: 1200</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', height: '1.5rem' }}>
              {renderCaptures(opponentCaptures, playerColor === 'w' ? 'w' : 'b')}
              {opponentAdvantage > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>+{opponentAdvantage}</span>}
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontFamily: 'monospace', fontWeight: 'bold', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: '4px' }}>
            {formatTime(playerColor === 'w' ? blackTime : whiteTime)}
          </div>
        </div>

        {/* Fix 2: Opponent Disconnected Banner */}
        {opponentDisconnected && !isGameOver && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ 
              width: '10px', height: '10px', borderRadius: '50%', 
              background: '#ef4444', 
              animation: 'pulse 1.5s infinite' 
            }} />
            <span style={{ color: '#fca5a5', fontSize: '0.9rem' }}>
              Opponent disconnected — waiting for reconnect...
            </span>
          </div>
        )}

        {/* Board */}
        <div style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', position: 'relative' }}>
          <Chessboard options={{
              position: fen,
              onPieceDrop: onDrop,
              onPieceDrag: onPieceDrag,
              onSquareClick: onSquareClick,
              onPieceDragCancel: onPieceDragCancel,
              squareStyles: dynamicSquareStyles,
              boardOrientation: playerColor === 'w' ? 'white' : 'black',
              darkSquareStyle: { backgroundColor: '#475569' },
              lightSquareStyle: { backgroundColor: '#cbd5e1' },
            }} />

          {/* Fix 1: Promotion Picker Overlay */}
          {pendingPromotion && (
            <>
              {/* Backdrop */}
              <div 
                onClick={cancelPromotion}
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.5)', zIndex: 10,
                  cursor: 'pointer'
                }}
              />
              {/* Picker */}
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex', gap: '0.5rem',
                background: 'rgba(30,30,40,0.95)',
                border: '2px solid var(--accent-color)',
                borderRadius: '12px',
                padding: '0.75rem 1rem',
                zIndex: 11,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
              }}>
                {Object.entries(PROMOTION_PIECES[playerColor]).map(([key, symbol]) => (
                  <button
                    key={key}
                    onClick={() => handlePromotionChoice(key)}
                    style={{
                      width: '56px', height: '56px',
                      fontSize: '2rem',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      color: playerColor === 'w' ? '#fff' : '#ddd',
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--accent-color)';
                      e.currentTarget.style.transform = 'scale(1.15)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Player Info */}
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 'bold' }}>{user?.username || 'You'}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Rating: 1200</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', height: '1.5rem' }}>
              {renderCaptures(myCaptures, playerColor === 'w' ? 'b' : 'w')}
              {myAdvantage > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>+{myAdvantage}</span>}
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontFamily: 'monospace', fontWeight: 'bold', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: '4px', color: gameRef.current.turn() === playerColor ? 'var(--success)' : 'inherit' }}>
            {formatTime(playerColor === 'w' ? whiteTime : blackTime)}
          </div>
        </div>
      </div>

      {/* Sidebar Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Move List */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '200px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem', padding: '0 0.5rem' }}>
            <h3 style={{ margin: 0 }}>Moves</h3>
            {openingName && <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 'bold' }}>{openingName}</span>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            {movePairs.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontStyle: 'italic', padding: '0.5rem' }}>Game started...</p>
            ) : (
              movePairs.map((pair, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '1rem', padding: '0.25rem 0.5rem', background: idx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)', width: '2rem' }}>{idx + 1}.</span>
                  <span style={{ flex: 1, fontWeight: 'bold' }}>{pair.w}</span>
                  <span style={{ flex: 1, fontWeight: 'bold' }}>{pair.b}</span>
                </div>
              ))
            )}
            <div ref={movesEndRef} />
          </div>
        </div>

        {isGameOver && (
          <div className="glass-panel animate-fade-in" style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--accent-color)' }}>
            <h3 style={{ color: 'var(--accent-color)', marginBottom: '0.5rem' }}>Game Over</h3>
            <p style={{ marginBottom: '0.5rem' }}>{gameOverReason}</p>
            {whiteRatingDelta !== null && blackRatingDelta !== null && (
              <div style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                Rating Changes: White {whiteRatingDelta > 0 ? '+' : ''}{whiteRatingDelta}, Black {blackRatingDelta > 0 ? '+' : ''}{blackRatingDelta}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => socket.emit('request_rematch', { gameId, userId: user?.id })} className="btn" style={{ flex: 1 }}>Rematch</button>
                <button onClick={() => {
                  navigator.clipboard.writeText(pgn).catch(console.error);
                }} className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}>Copy PGN</button>
              </div>
              <button onClick={() => navigate('/')} className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}>Back to Lobby</button>
            </div>
          </div>
        )}

        {drawOffer && !isGameOver && (
          <div className="glass-panel animate-fade-in" style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--accent-color)' }}>
            <h3 style={{ color: 'var(--accent-color)', marginBottom: '0.5rem' }}>Draw Offered</h3>
            <p>Your opponent has offered a draw.</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={() => { socket.emit('respond_draw', { gameId, userId: user?.id, accept: true }); setDrawOffer(false); }} className="btn" style={{ flex: 1 }}>Accept</button>
              <button onClick={() => { socket.emit('respond_draw', { gameId, userId: user?.id, accept: false }); setDrawOffer(false); }} className="btn" style={{ flex: 1, background: 'var(--danger)' }}>Decline</button>
            </div>
          </div>
        )}

        {showRematchPrompt && (
          <div className="glass-panel animate-fade-in" style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--accent-color)' }}>
            <h3 style={{ color: 'var(--accent-color)', marginBottom: '0.5rem' }}>Rematch?</h3>
            <p>Your opponent wants a rematch.</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={() => { socket.emit('respond_rematch', { gameId, userId: user?.id, accept: true }); setShowRematchPrompt(false); }} className="btn" style={{ flex: 1 }}>Accept</button>
              <button onClick={() => { socket.emit('respond_rematch', { gameId, userId: user?.id, accept: false }); setShowRematchPrompt(false); }} className="btn" style={{ flex: 1, background: 'var(--danger)' }}>Decline</button>
            </div>
          </div>
        )}

        {showTakebackPrompt && !isGameOver && (
          <div className="glass-panel animate-fade-in" style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--accent-color)' }}>
            <h3 style={{ color: 'var(--accent-color)', marginBottom: '0.5rem' }}>Takeback Request</h3>
            <p>Your opponent requested a takeback.</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={() => { socket.emit('respond_takeback', { gameId, userId: user?.id, accept: true }); setShowTakebackPrompt(false); }} className="btn" style={{ flex: 1 }}>Accept</button>
              <button onClick={() => { socket.emit('respond_takeback', { gameId, userId: user?.id, accept: false }); setShowTakebackPrompt(false); }} className="btn" style={{ flex: 1, background: 'var(--danger)' }}>Decline</button>
            </div>
          </div>
        )}

        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1rem' }}>Chat</h3>
          <div style={{ flex: 1, minHeight: '300px', maxHeight: '400px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {messages.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontStyle: 'italic' }}>Chat connected...</p>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: msg.username === user?.username ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: 'bold' }}>
                    {msg.username}
                  </span>
                  <div style={{ background: msg.username === user?.username ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                    {msg.text}
                  </div>
                </div>
              ))
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Send a message..." 
              style={{ flex: 1, padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }} 
            />
            <button onClick={handleSendMessage} className="btn" style={{ padding: '0.5rem 1rem' }}>Send</button>
          </div>
        </div>

        {/* Fix 3: Resign with confirmation + Draw button */}
        {playerColor !== 'viewer' && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {showResignConfirm ? (
            <div style={{ 
              flex: 1, display: 'flex', gap: '0.5rem', 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.3)', 
              borderRadius: '8px', 
              padding: '0.5rem',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.8rem', color: '#fca5a5', flex: 1, textAlign: 'center' }}>Resign?</span>
              <button 
                onClick={handleResign} 
                className="btn" 
                style={{ background: '#ef4444', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
              >Yes</button>
              <button 
                onClick={() => setShowResignConfirm(false)} 
                className="btn" 
                style={{ background: 'rgba(255,255,255,0.1)', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
              >Cancel</button>
            </div>
          ) : (
            <button 
              onClick={() => setShowResignConfirm(true)} 
              className="btn" 
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}
            >Resign</button>
          )}
          <button onClick={() => socket.emit('offer_draw', { gameId, userId: user?.id })} className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}>Draw</button>
          
          {isCasual && (
            <button 
              onClick={() => socket.emit('request_takeback', { gameId, userId: user?.id })} 
              className="btn" 
              title="Request Takeback"
              style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}
            >
              ↩
            </button>
          )}
        </div>
        )}
      </div>

      {/* Inline styles for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
