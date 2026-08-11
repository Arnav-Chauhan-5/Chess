import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

export default function GameRoom() {
  const { gameId } = useParams();
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [game, setGame] = useState(new Chess());
  const [playerColor, setPlayerColor] = useState('w'); // default, we should get this from server
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState('');
  
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    if (!socket || !user) return;

    socket.emit('join_game_room', { gameId, userId: user.id });

    socket.on('game_state_sync', (data) => {
      const newGame = new Chess(data.fen);
      setGame(newGame);
      setWhiteTime(data.whiteTimeLeftMs);
      setBlackTime(data.blackTimeLeftMs);
      
      if (data.whiteId === user.id) setPlayerColor('w');
      else if (data.blackId === user.id) setPlayerColor('b');
      else setPlayerColor('viewer');
    });

    socket.on('opponent_moved', (data) => {
      setGame(prev => {
        const newGame = new Chess(prev.fen());
        newGame.move(data.move);
        return newGame;
      });
      setWhiteTime(data.whiteTimeLeftMs);
      setBlackTime(data.blackTimeLeftMs);
    });

    socket.on('ai_moved', (data) => {
      setGame(prev => {
        const newGame = new Chess(prev.fen());
        newGame.move(data.move);
        return newGame;
      });
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
    });
    
    socket.on('receive_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.off('game_state_sync');
      socket.off('opponent_moved');
      socket.off('ai_moved');
      socket.off('move_confirmed');
      socket.off('game_over');
      socket.off('receive_message');
    };
  }, [socket, gameId, user]);

  // Very basic clock tick effect
  useEffect(() => {
    if (isGameOver) return;
    const interval = setInterval(() => {
      if (game.turn() === 'w') {
        setWhiteTime(t => Math.max(0, t - 100));
      } else {
        setBlackTime(t => Math.max(0, t - 100));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [game, isGameOver]);

  const onDrop = (sourceSquare, targetSquare) => {
    if (isGameOver) return false;
    
    // Only allow moves for our color
    if (game.turn() !== playerColor) return false;

    try {
      const newGame = new Chess(game.fen());
      const move = newGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // always promote to queen for MVP
      });

      if (move === null) return false;
      
      // Optimistic update
      setGame(newGame);
      
      socket.emit('make_move', {
        gameId,
        userId: user?.id,
        move: move.san
      });

      return true;
    } catch (e) {
      return false;
    }
  };

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
          </div>
          <div style={{ fontSize: '1.5rem', fontFamily: 'monospace', fontWeight: 'bold', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: '4px' }}>
            {formatTime(playerColor === 'w' ? blackTime : whiteTime)}
          </div>
        </div>

        {/* Board */}
        <div style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          <Chessboard 
            position={game.fen()} 
            onPieceDrop={onDrop}
            boardOrientation={playerColor === 'w' ? 'white' : 'black'}
            customDarkSquareStyle={{ backgroundColor: '#475569' }}
            customLightSquareStyle={{ backgroundColor: '#cbd5e1' }}
          />
        </div>

        {/* Player Info */}
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 'bold' }}>{user?.username || 'You'}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Rating: 1200</div>
          </div>
          <div style={{ fontSize: '1.5rem', fontFamily: 'monospace', fontWeight: 'bold', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: '4px', color: game.turn() === playerColor ? 'var(--success)' : 'inherit' }}>
            {formatTime(playerColor === 'w' ? whiteTime : blackTime)}
          </div>
        </div>
      </div>

      {/* Sidebar Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {isGameOver && (
          <div className="glass-panel animate-fade-in" style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--accent-color)' }}>
            <h3 style={{ color: 'var(--accent-color)', marginBottom: '0.5rem' }}>Game Over</h3>
            <p>{gameOverReason}</p>
            <button onClick={() => navigate('/')} className="btn" style={{ width: '100%', marginTop: '1rem' }}>Back to Lobby</button>
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

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => socket.emit('resign', { gameId, userId: user?.id })} className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}>Resign</button>
          <button className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}>Draw</button>
        </div>
      </div>
    </div>
  );
}
