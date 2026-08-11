import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import { Play, Users, Zap, Flame, Snail, Timer, Hash } from 'lucide-react';

const PRESETS = [
  { label: '1+0', icon: Zap },
  { label: '3+2', icon: Flame },
  { label: '5+0', icon: Flame },
  { label: '10+0', icon: Timer },
  { label: '15+10', icon: Snail }
];

export default function Lobby() {
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [queueStatus, setQueueStatus] = useState('idle');
  const [selectedPreset, setSelectedPreset] = useState(null);
  
  const [customMins, setCustomMins] = useState(10);
  const [customInc, setCustomInc] = useState(0);
  const [roomId, setRoomId] = useState('');
  const [hostedRoom, setHostedRoom] = useState(null);

  const [openSeeks, setOpenSeeks] = useState([]);
  const [recentGames, setRecentGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.emit('get_seeks'); // Fetch initial seeks

    socket.on('queue_status', (data) => {
      setQueueStatus(data.status);
    });

    socket.on('seeks_updated', (seeks) => {
      // Filter out our own seeks from the list to avoid playing ourselves
      setOpenSeeks(seeks.filter(s => s.userId !== user?.id));
    });

    socket.on('match_found', (data) => {
      navigate(`/game/${data.gameId}`);
    });

    socket.on('room_created', (data) => {
      setHostedRoom(data);
    });

    socket.on('room_joined', (data) => {
      if (hostedRoom) {
        setHostedRoom({ ...hostedRoom, guestId: data.guestId });
      }
    });

    socket.on('game_started', (data) => {
      navigate(`/game/${data.gameId}`);
    });

    socket.on('error', (err) => {
      alert(err.message);
    });

    return () => {
      socket.off('queue_status');
      socket.off('seeks_updated');
      socket.off('match_found');
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('game_started');
      socket.off('error');
    };
  }, [socket, navigate, hostedRoom, user]);

  useEffect(() => {
    if (!user) return;
    const fetchRecentGames = async () => {
      try {
        setLoadingGames(true);
        const res = await fetch(`http://localhost:3000/games/recent?userId=${user.id}`);
        const data = await res.json();
        if (res.ok) {
          setRecentGames(data.games || []);
        }
      } catch (err) {
        console.error("Failed to fetch recent games", err);
      } finally {
        setLoadingGames(false);
      }
    };
    fetchRecentGames();
  }, [user]);

  const handleJoinQueue = (preset) => {
    if (!user) return alert('Please login first');
    setSelectedPreset(preset.label);
    socket.emit('join_queue', { userId: user.id, username: user.username, rating: user.rating || 1200, preset: preset.label });
  };

  const handleCancelQueue = () => {
    socket.emit('leave_queue');
  };

  const handleCreateRoom = () => {
    if (!user) return alert('Please login first');
    socket.emit('create_room', { 
      userId: user.id, 
      username: user.username,
      timeControlSec: customMins * 60, 
      incrementSec: customInc 
    });
  };

  const handleJoinRoom = () => {
    if (!user) return alert('Please login first');
    if (!roomId) return;
    socket.emit('join_room', { roomId, userId: user.id });
  };

  const handleStartRoomGame = () => {
    if (hostedRoom) {
      socket.emit('start_game', { roomId: hostedRoom.roomId });
    }
  };

  const handleAcceptSeek = (seek) => {
    if (!user) return alert('Please login first');
    if (seek.type === 'queue') {
      socket.emit('accept_seek', { 
        targetUserId: seek.userId, 
        preset: seek.preset,
        currentUserId: user.id,
        currentUsername: user.username,
        rating: user.rating || 1200
      });
    } else if (seek.type === 'lobby') {
      socket.emit('join_room', { roomId: seek.roomId, userId: user.id });
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', padding: '2rem', maxWidth: '1200px', margin: '0 auto' }} className="lobby-grid">
      
      {/* LEFT COLUMN: Pairing & Seeks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Quick Pairing */}
        <div className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.25rem' }}>
            <Play size={20} color="var(--accent-color)" /> Quick Pairing
          </h2>
          
          {queueStatus === 'searching' ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Searching for opponent...</div>
              <p style={{ color: 'var(--accent-color)', marginBottom: '2rem', fontSize: '1.25rem', fontWeight: 'bold' }}>{selectedPreset}</p>
              <button onClick={handleCancelQueue} className="btn" style={{ background: 'var(--danger)', padding: '0.75rem 2rem' }}>
                Cancel Search
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
              {PRESETS.map((preset, i) => (
                <button 
                  key={preset.label}
                  onClick={() => handleJoinQueue(preset)}
                  className="preset-btn" 
                  style={{ 
                    background: 'rgba(255,255,255,0.03)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    color: 'var(--text-primary)', 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.5rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    animation: `fadeIn 0.3s ease forwards ${i * 0.05}s`
                  }}
                >
                  <preset.icon size={28} style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }} className="preset-icon" />
                  <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{preset.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Open Seeks */}
        <div className="glass-panel animate-fade-in" style={{ padding: '2rem', flex: 1, animationDelay: '0.1s' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.25rem' }}>
            <Users size={20} color="var(--accent-color)" /> Open Challenges
          </h2>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem 0.5rem', fontWeight: 'normal' }}>Player</th>
                  <th style={{ padding: '1rem 0.5rem', fontWeight: 'normal' }}>Rating</th>
                  <th style={{ padding: '1rem 0.5rem', fontWeight: 'normal' }}>Time</th>
                  <th style={{ padding: '1rem 0.5rem', fontWeight: 'normal' }}></th>
                </tr>
              </thead>
              <tbody>
                {openSeeks.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No open challenges right now. Join the queue!
                    </td>
                  </tr>
                ) : (
                  openSeeks.map((seek, i) => (
                    <tr key={i} className="seek-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '1rem 0.5rem', fontWeight: 'bold' }}>{seek.username}</td>
                      <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>{seek.rating}</td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        {seek.type === 'queue' ? seek.preset : `${seek.timeControlSec/60}+${seek.incrementSec}`}
                      </td>
                      <td style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleAcceptSeek(seek)}
                          style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          Play
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Play a Friend & Recent Games */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Custom Lobby */}
        <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', animationDelay: '0.2s' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
            <Hash size={18} color="var(--accent-color)" /> Play a Friend
          </h2>

          {hostedRoom ? (
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Room Created</h3>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '4px', textAlign: 'center', marginBottom: '1rem', fontFamily: 'monospace', fontSize: '1.25rem', letterSpacing: '2px', color: 'var(--accent-color)' }}>
                {hostedRoom.roomId}
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginBottom: '1rem' }}>
                {hostedRoom.guestId ? 'Opponent has joined!' : 'Waiting for opponent...'}
              </p>
              <button 
                onClick={handleStartRoomGame} 
                className="btn" 
                disabled={!hostedRoom.guestId}
                style={{ width: '100%', padding: '0.75rem' }}
              >
                Start Game
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Create Room</h3>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Mins</label>
                    <input type="number" value={customMins} onChange={e => setCustomMins(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Inc</label>
                    <input type="number" value={customInc} onChange={e => setCustomInc(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }} />
                  </div>
                </div>
                <button onClick={handleCreateRoom} className="btn" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', padding: '0.75rem', fontSize: '0.9rem' }}>Create Room</button>
              </div>

              <div style={{ height: '1px', background: 'var(--border-color)' }}></div>

              <div>
                <h3 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Join with Code</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="Room ID" 
                    value={roomId} 
                    onChange={e => setRoomId(e.target.value)}
                    style={{ flex: 1, padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                  />
                  <button onClick={handleJoinRoom} className="btn" style={{ padding: '0.5rem 1rem' }}>Join</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Games */}
        <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', flex: 1, animationDelay: '0.3s' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
            <Timer size={18} color="var(--accent-color)" /> Recent Games
          </h2>
          
          {loadingGames ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading...</p>
          ) : recentGames.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No recent games found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentGames.map(game => {
                const isWhite = game.whiteId === user?.id;
                const opponent = isWhite ? (game.blackPlayer?.username || 'AI') : (game.whitePlayer?.username || 'AI');
                
                // Determine result text
                let resultClass = 'text-secondary';
                let resultText = 'Draw';
                if (game.status === 'WHITE_WON') {
                  resultClass = isWhite ? 'text-success' : 'text-danger';
                  resultText = isWhite ? 'Won' : 'Lost';
                } else if (game.status === 'BLACK_WON') {
                  resultClass = !isWhite ? 'text-success' : 'text-danger';
                  resultText = !isWhite ? 'Won' : 'Lost';
                }

                return (
                  <Link 
                    to={`/game/${game.id}`} 
                    key={game.id}
                    className="recent-game-card"
                    style={{ 
                      display: 'block',
                      padding: '0.75rem', 
                      background: 'rgba(255,255,255,0.02)', 
                      borderRadius: '6px', 
                      textDecoration: 'none',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>vs {opponent}</span>
                      <span className={resultClass} style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{resultText}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      <span>{game.timeControlSec/60}+{game.incrementSec}</span>
                      <span>{new Date(game.createdAt).toLocaleDateString()}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .preset-btn:hover {
          background: rgba(255,255,255,0.08) !important;
          transform: translateY(-2px);
          border-color: var(--accent-color) !important;
        }
        .preset-btn:hover .preset-icon {
          color: var(--accent-color) !important;
        }
        .seek-row:hover {
          background: rgba(255,255,255,0.03) !important;
        }
        .recent-game-card:hover {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }
        .text-secondary { color: var(--text-secondary); }
        
        @media (max-width: 900px) {
          .lobby-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
