import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import DecorativeBoard from '../components/DecorativeBoard';
import { Play, Users, Zap, Flame, Snail, Timer, Hash, Bot, Eye } from 'lucide-react';

const PRESETS = [
  { label: '1+0', icon: Zap },
  { label: '3+2', icon: Flame },
  { label: '5+0', icon: Flame },
  { label: '10+0', icon: Timer },
  { label: '15+10', icon: Snail }
];

const AI_BOTS = [
  { label: 'Beginner', rating: 800, style: 'Positional', difficulty: 1 },
  { label: 'Club Player', rating: 1200, style: 'Tactical', difficulty: 3 },
  { label: 'Expert', rating: 1800, style: 'Aggressive', difficulty: 5 },
  { label: 'Master', rating: 2400, style: 'Solid', difficulty: 8 },
  { label: 'Grandmaster', rating: 2800, style: 'Universal', difficulty: 10 },
];

export default function Lobby() {
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('ai');
  const [queueStatus, setQueueStatus] = useState('idle');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [expandedBot, setExpandedBot] = useState(null);
  const [aiTimePreset, setAiTimePreset] = useState('10+0');
  
  const [customMins, setCustomMins] = useState(10);
  const [customInc, setCustomInc] = useState(0);
  const [roomId, setRoomId] = useState('');
  const [hostedRoom, setHostedRoom] = useState(null);

  const [openSeeks, setOpenSeeks] = useState([]);
  const [liveGames, setLiveGames] = useState([]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('get_seeks');
    socket.emit('get_live_games');

    socket.on('queue_status', (data) => {
      setQueueStatus(data.status);
    });

    socket.on('seeks_updated', (seeks) => {
      setOpenSeeks(seeks.filter(s => s.userId !== user?.id));
    });

    socket.on('live_games_updated', (games) => {
      setLiveGames(games);
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
      socket.off('live_games_updated');
      socket.off('match_found');
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('game_started');
      socket.off('error');
    };
  }, [socket, navigate, hostedRoom, user]);

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

  const handleStartAIGame = (bot, preferredColor) => {
    if (!user) return alert('Please login first');
    const [minStr, incStr] = aiTimePreset.split('+');
    const timeControlSec = parseInt(minStr) * 60;
    const incrementSec = parseInt(incStr);
    socket.emit('start_ai_game', { 
      userId: user.id, 
      difficulty: bot.difficulty,
      timeControlSec,
      incrementSec,
      preferredColor
    });
    setExpandedBot(null);
  };

  const tabStyle = (isActive) => ({
    flex: 1,
    padding: '0.85rem 1.5rem',
    background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
    border: 'none',
    borderBottom: isActive ? '2px solid var(--accent-color)' : '2px solid transparent',
    color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
    cursor: 'pointer',
    fontWeight: isActive ? '700' : '500',
    fontSize: '1rem',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem'
  });

  return (
    <div style={{ display: 'flex', gap: '3rem', padding: '2rem', maxWidth: '1200px', margin: '0 auto', alignItems: 'flex-start' }} className="lobby-grid">
      
      {/* LEFT COLUMN: Decorative Board */}
      <div style={{ flex: '0 0 auto', position: 'sticky', top: '90px' }} className="lobby-board">
        <DecorativeBoard autoplay={false} />
        
        {/* Live Games below the board */}
        {liveGames.length > 0 && (
          <div className="glass-panel animate-fade-in" style={{ padding: '1.25rem', marginTop: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '1rem' }}>
              <Eye size={16} color="var(--accent-color)" /> Live Games
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {liveGames.map((game, i) => (
                <Link
                  key={i}
                  to={`/game/${game.gameId}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.6rem 0.75rem',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    color: 'var(--text-primary)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    transition: 'all 0.2s',
                    fontSize: '0.85rem'
                  }}
                  className="seek-row"
                >
                  <span><strong>{game.whiteUsername}</strong> vs <strong>{game.blackUsername}</strong></span>
                  <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '0.8rem' }}>Watch</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Tabbed Panel */}
      <div style={{ flex: 1, minWidth: 0 }}>
        
        {/* Tab Buttons */}
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', marginBottom: '0' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
            <button style={tabStyle(activeTab === 'ai')} onClick={() => setActiveTab('ai')}>
              <Bot size={18} /> vs AI
            </button>
            <button style={tabStyle(activeTab === 'player')} onClick={() => setActiveTab('player')}>
              <Users size={18} /> vs Player
            </button>
          </div>

          <div style={{ padding: '1.5rem' }}>
            
            {/* TAB 1: vs AI */}
            {activeTab === 'ai' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {AI_BOTS.map((bot, i) => {
                  const isExpanded = expandedBot === bot.label;
                  return (
                    <div key={bot.label} style={{ animation: `fadeIn 0.3s ease forwards ${i * 0.06}s` }}>
                      <button 
                        onClick={() => setExpandedBot(isExpanded ? null : bot.label)}
                        className="ai-bot-btn"
                        style={{ 
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: isExpanded ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)', 
                          border: `1px solid ${isExpanded ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)'}`, 
                          padding: '1rem 1.25rem',
                          borderRadius: isExpanded ? '8px 8px 0 0' : '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'left',
                          width: '100%'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                            {bot.label} <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'normal' }}>({bot.rating})</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Style: {bot.style}
                          </div>
                        </div>
                        <div style={{ background: 'var(--accent-color)', color: 'white', padding: '0.4rem 1rem', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                          {isExpanded ? '▾' : 'Play'}
                        </div>
                      </button>
                      
                      {isExpanded && (
                        <div style={{ 
                          background: 'rgba(255,255,255,0.04)', 
                          border: '1px solid var(--accent-color)', 
                          borderTop: 'none',
                          borderRadius: '0 0 8px 8px', 
                          padding: '1rem 1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem'
                        }}>
                          {/* Time control */}
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Time Control</div>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {PRESETS.map(p => (
                                <button 
                                  key={p.label}
                                  onClick={() => setAiTimePreset(p.label)}
                                  style={{ 
                                    padding: '0.35rem 0.65rem', 
                                    borderRadius: '4px', 
                                    border: '1px solid', 
                                    borderColor: aiTimePreset === p.label ? 'var(--accent-color)' : 'rgba(255,255,255,0.15)',
                                    background: aiTimePreset === p.label ? 'var(--accent-color)' : 'transparent',
                                    color: 'white', 
                                    cursor: 'pointer', 
                                    fontSize: '0.85rem',
                                    fontWeight: aiTimePreset === p.label ? 'bold' : 'normal',
                                    transition: 'all 0.15s'
                                  }}
                                >{p.label}</button>
                              ))}
                            </div>
                          </div>

                          {/* Color choice */}
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Play As</div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                onClick={() => handleStartAIGame(bot, 'white')}
                                className="ai-color-btn"
                                style={{ flex: 1, padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', transition: 'all 0.15s' }}
                              >♔ White</button>
                              <button 
                                onClick={() => handleStartAIGame(bot, 'random')}
                                className="ai-color-btn"
                                style={{ flex: 1, padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', transition: 'all 0.15s' }}
                              >⚄ Random</button>
                              <button 
                                onClick={() => handleStartAIGame(bot, 'black')}
                                className="ai-color-btn"
                                style={{ flex: 1, padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', transition: 'all 0.15s' }}
                              >♚ Black</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: vs Player */}
            {activeTab === 'player' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Quick Pairing */}
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '1.05rem' }}>
                    <Play size={18} color="var(--accent-color)" /> Quick Pairing
                  </h3>
                  
                  {queueStatus === 'searching' ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Searching for opponent...</div>
                      <p style={{ color: 'var(--accent-color)', marginBottom: '1.5rem', fontSize: '1.15rem', fontWeight: 'bold' }}>{selectedPreset}</p>
                      <button onClick={handleCancelQueue} className="btn" style={{ background: 'var(--danger)', padding: '0.6rem 1.5rem' }}>
                        Cancel Search
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.75rem' }}>
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
                            padding: '1.25rem 0.75rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            animation: `fadeIn 0.3s ease forwards ${i * 0.05}s`
                          }}
                        >
                          <preset.icon size={24} style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }} className="preset-icon" />
                          <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: 'var(--border-color)' }} />

                {/* Play a Friend */}
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '1.05rem' }}>
                    <Hash size={18} color="var(--accent-color)" /> Play a Friend
                  </h3>

                  {hostedRoom ? (
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Room Created</h4>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      {/* Create Room */}
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <h4 style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Create Room</h4>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Mins</label>
                            <input type="number" value={customMins} onChange={e => setCustomMins(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Inc</label>
                            <input type="number" value={customInc} onChange={e => setCustomInc(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }} />
                          </div>
                        </div>
                        <button onClick={handleCreateRoom} className="btn" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', padding: '0.6rem', fontSize: '0.85rem' }}>Create</button>
                      </div>

                      {/* Join with Code */}
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <h4 style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Join with Code</h4>
                        <input 
                          type="text" 
                          placeholder="Room ID" 
                          value={roomId} 
                          onChange={e => setRoomId(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', marginBottom: '0.75rem' }}
                        />
                        <button onClick={handleJoinRoom} className="btn" style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}>Join Room</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: 'var(--border-color)' }} />

                {/* Open Challenges */}
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '1.05rem' }}>
                    <Users size={18} color="var(--accent-color)" /> Open Challenges
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'normal', fontSize: '0.85rem' }}>Player</th>
                          <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'normal', fontSize: '0.85rem' }}>Rating</th>
                          <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'normal', fontSize: '0.85rem' }}>Time</th>
                          <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'normal', fontSize: '0.85rem' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {openSeeks.length === 0 ? (
                          <tr>
                            <td colSpan="4" style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                              No open challenges right now. Join the queue!
                            </td>
                          </tr>
                        ) : (
                          openSeeks.map((seek, i) => (
                            <tr key={i} className="seek-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                              <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>{seek.username}</td>
                              <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{seek.rating}</td>
                              <td style={{ padding: '0.75rem 0.5rem' }}>
                                {seek.type === 'queue' ? seek.preset : `${seek.timeControlSec/60}+${seek.incrementSec}`}
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                                <button 
                                  onClick={() => handleAcceptSeek(seek)}
                                  style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '0.4rem 0.85rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
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
            )}
          </div>
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
        .ai-bot-btn:hover {
          background: rgba(255,255,255,0.08) !important;
          transform: translateY(-2px);
          border-color: var(--accent-color) !important;
        }
        .ai-color-btn:hover {
          background: var(--accent-color) !important;
          color: white !important;
          border-color: var(--accent-color) !important;
          transform: translateY(-1px);
        }
        .seek-row:hover {
          background: rgba(255,255,255,0.03) !important;
        }
        
        @media (max-width: 900px) {
          .lobby-grid {
            flex-direction: column !important;
          }
          .lobby-board {
            position: static !important;
            display: flex;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
