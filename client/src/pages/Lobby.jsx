import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import DecorativeBoard from '../components/DecorativeBoard';
import { Play, Users, Zap, Flame, Snail, Timer, Hash, Bot, Eye, BarChart2, UserPlus, Swords } from 'lucide-react';
import { getTimeCategory } from '../utils/timeControl';

const PRESETS = [
  { label: '1+0', icon: Zap },
  { label: '3+2', icon: Flame },
  { label: '5+0', icon: Flame },
  { label: '10+0', icon: Timer },
  { label: '15+10', icon: Snail }
];

const AI_BOTS = [
  { label: 'Rookie Sam', rating: 400, style: 'Beginner', difficulty: 1, color: '#3b82f6' },
  { label: 'Pawn Pusher Vik', rating: 700, style: 'Cautious', difficulty: 2, color: '#8b5cf6' },
  { label: 'Club Regular Dee', rating: 1000, style: 'Balanced', difficulty: 3, color: '#10b981' },
  { label: 'Tactical Rae', rating: 1300, style: 'Tactical', difficulty: 4, color: '#f59e0b' },
  { label: 'Iron Wall Otto', rating: 1600, style: 'Defensive', difficulty: 5, color: '#64748b' },
  { label: 'Blitz Nova', rating: 1900, style: 'Aggressive', difficulty: 6, color: '#ef4444' },
  { label: 'Endgame Elias', rating: 2200, style: 'Precise', difficulty: 7, color: '#0ea5e9' },
  { label: 'Positional Wren', rating: 2450, style: 'Positional', difficulty: 8, color: '#14b8a6' },
  { label: 'Chaos Theory', rating: 2650, style: 'Unpredictable', difficulty: 9, color: '#f43f5e' },
  { label: 'The Oracle', rating: 2850, style: 'Universal', difficulty: 10, color: '#eab308' },
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

  // New states for widgets
  const [userStats, setUserStats] = useState(null);
  const [recentGames, setRecentGames] = useState([]);
  const [onlineFriends, setOnlineFriends] = useState([]);
  const [allFriends, setAllFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null); // For inline challenge picker
  
  const [playerSubTab, setPlayerSubTab] = useState('random');
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (!socket) return;

    socket.emit('get_seeks');
    socket.emit('get_live_games');

    // Fetch user profile stats
    if (user) {
      fetch(`http://localhost:3000/users/profile?userId=${user.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.stats) {
          setUserStats(data.stats);
          setRecentGames(data.recentGames || []);
        }
      })
      .catch(err => console.error(err));

      // Fetch friends
      fetch(`http://localhost:3000/friends/${user.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.accepted) {
          setAllFriends(data.accepted);
          setOnlineFriends(data.accepted.filter(f => f.isOnline));
        }
      })
      .catch(err => console.error(err));
    }

    socket.on('queue_status', (data) => {
      setQueueStatus(data.status);
    });

    socket.on('seeks_updated', (seeks) => {
      setOpenSeeks(seeks.filter(s => s.userId !== user?.id));
    });

    socket.on('live_games_updated', (games) => {
      setLiveGames(games);
    });

    socket.on('friend_status_changed', ({ userId, isOnline }) => {
      // Re-fetch friends to get updated list, or just manually update if we had all friends
      // Since we only store onlineFriends, it's easier to just re-fetch
      if (user) {
        fetch(`http://localhost:3000/friends/${user.id}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(data => {
          if (data.accepted) {
            setAllFriends(data.accepted);
            setOnlineFriends(data.accepted.filter(f => f.isOnline));
          }
        });
      }
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
      socket.off('friend_status_changed');
      socket.off('match_found');
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('game_started');
      socket.off('error');
    };
  }, [socket, navigate, hostedRoom, user]);


  const handleSearchUser = async (e) => {
    e.preventDefault();
    if (!searchUsername.trim()) return;
    setSearchError('');
    setSearchResult(null);
    try {
      const res = await fetch(`http://localhost:3000/users/search?username=${encodeURIComponent(searchUsername.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSearchResult(data.user);
    } catch (err) {
      setSearchError(err.message);
    }
  };

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

  const handleChallengeFriend = (friend, preset) => {
    const [minStr, incStr] = preset.label.split('+');
    const timeControlSec = parseInt(minStr) * 60;
    const incrementSec = parseInt(incStr);
    
    socket.emit('challenge_friend', {
      fromUserId: user.id,
      fromUsername: user.username,
      toUserId: friend.id,
      timeControlSec,
      incrementSec
    });
    alert(`Challenge sent to ${friend.username}!`);
    setSelectedFriend(null);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} color="var(--text-secondary)" />
          </div>
          <div>
            <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Opponent</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Waiting for game...</div>
          </div>
        </div>
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

        {/* User Stats Card */}
        {userStats && (
          <div className="glass-panel animate-fade-in" style={{ padding: '1.25rem', marginTop: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '1rem' }}>
              <BarChart2 size={16} color="var(--accent-color)" /> Your Stats
            </h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rating</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{user.rating || 1200}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Record</div>
                <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                  <span style={{ color: '#10b981' }}>{userStats.wins}</span> - <span style={{ color: 'var(--danger)' }}>{userStats.losses}</span> - <span style={{ color: '#9ca3af' }}>{userStats.draws}</span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Recent Form</div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {recentGames.length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No games played</span>
                ) : (
                  recentGames.slice(0, 5).map((game, i) => {
                    const isWhite = game.whiteId === user.id;
                    let resultColor = '#9ca3af'; // draw
                    if (game.status === 'WHITE_WON') resultColor = isWhite ? '#10b981' : 'var(--danger)';
                    if (game.status === 'BLACK_WON') resultColor = !isWhite ? '#10b981' : 'var(--danger)';
                    return (
                      <div key={i} style={{ width: '16px', height: '16px', borderRadius: '2px', background: resultColor }} title={game.status} />
                    );
                  })
                )}
              </div>
            </div>
            
            <Link to={`/profile?userId=${user.id}`} style={{ display: 'block', textAlign: 'center', color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold' }}>
              View full profile →
            </Link>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Tabbed Panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
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
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ 
                            width: '40px', 
                            height: '40px', 
                            borderRadius: '50%', 
                            background: bot.color, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            color: 'white',
                            flexShrink: 0
                          }}>
                            {bot.label.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                              {bot.label} <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'normal' }}>({bot.rating})</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              Style: {bot.style}
                            </div>
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
                
                {/* Sub-tabs for Play a Friend */}
                <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  {['random', 'friend', 'search'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setPlayerSubTab(tab)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: playerSubTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: playerSubTab === tab ? 'white' : 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: playerSubTab === tab ? 'bold' : 'normal',
                        textTransform: 'capitalize',
                        transition: 'all 0.2s'
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Sub-tab Content */}
                <div style={{ minHeight: '180px' }}>
                  
                  {/* RANDOM TAB */}
                  {playerSubTab === 'random' && (
                    <div className="animate-fade-in">
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
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                {getTimeCategory(parseInt(preset.label.split('+')[0]))}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* FRIEND TAB */}
                  {playerSubTab === 'friend' && (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                      {allFriends.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                          No friends added yet. Try the Search tab or add friends in the Friends page.
                        </div>
                      ) : (
                        allFriends.map(friend => (
                          <div key={friend.id} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ position: 'relative' }}>
                                  <div style={{ width: '28px', height: '28px', background: 'var(--accent-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', color: 'white' }}>
                                    {friend.username.charAt(0).toUpperCase()}
                                  </div>
                                  <div style={{ position: 'absolute', bottom: -2, right: -2, width: '10px', height: '10px', borderRadius: '50%', background: friend.isOnline ? '#10b981' : '#6b7280', border: '2px solid var(--bg-color)' }}></div>
                                </div>
                                <div>
                                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{friend.username}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{friend.rating}</div>
                                </div>
                              </div>
                              <button 
                                onClick={() => setSelectedFriend(selectedFriend === friend.id ? null : friend.id)}
                                style={{ background: selectedFriend === friend.id ? 'rgba(255,255,255,0.1)' : 'var(--accent-color)', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                              >
                                {selectedFriend === friend.id ? 'Cancel' : 'Challenge'}
                              </button>
                            </div>
                            
                            {/* Inline Time Control Picker for Friend Challenge */}
                            {selectedFriend === friend.id && (
                              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {PRESETS.map(preset => (
                                  <button
                                    key={preset.label}
                                    onClick={() => handleChallengeFriend(friend, preset)}
                                    style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontSize: '0.75rem' }}
                                    onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent-color)'; e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* SEARCH TAB */}
                  {playerSubTab === 'search' && (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <form onSubmit={handleSearchUser} style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder="Search username to challenge..."
                          value={searchUsername}
                          onChange={e => setSearchUsername(e.target.value)}
                          style={{ flex: 1, padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', outline: 'none' }}
                        />
                        <button type="submit" className="btn" style={{ padding: '0 1.5rem' }}>Find</button>
                      </form>
                      
                      {searchError && <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{searchError}</div>}
                      
                      {searchResult && (
                        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ position: 'relative' }}>
                                <div style={{ width: '32px', height: '32px', background: 'var(--accent-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem', color: 'white' }}>
                                  {searchResult.username.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ position: 'absolute', bottom: -2, right: -2, width: '10px', height: '10px', borderRadius: '50%', background: searchResult.showOnlineStatus ? '#10b981' : '#6b7280', border: '2px solid var(--bg-color)' }}></div>
                              </div>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{searchResult.username}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Rating: {searchResult.rating}</div>
                              </div>
                            </div>
                            <button 
                              onClick={() => setSelectedFriend(selectedFriend === searchResult.id ? null : searchResult.id)}
                              style={{ background: selectedFriend === searchResult.id ? 'rgba(255,255,255,0.1)' : 'var(--accent-color)', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                            >
                              {selectedFriend === searchResult.id ? 'Cancel' : 'Challenge'}
                            </button>
                          </div>

                          {/* Inline Time Control Picker for Search Challenge */}
                          {selectedFriend === searchResult.id && (
                            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {PRESETS.map(preset => (
                                <button
                                  key={preset.label}
                                  onClick={() => handleChallengeFriend(searchResult, preset)}
                                  style={{ padding: '0.25rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}
                                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent-color)'; e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Secondary: Invite by Link */}
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Invite by Link / Code</h4>
                  {hostedRoom ? (
                    <div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '4px', textAlign: 'center', marginBottom: '1rem', fontFamily: 'monospace', fontSize: '1.25rem', letterSpacing: '2px', color: 'var(--accent-color)' }}>
                        {hostedRoom.roomId}
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1rem' }}>
                        {hostedRoom.guestId ? 'Opponent has joined!' : 'Waiting for opponent...'}
                      </p>
                      <button 
                        onClick={handleStartRoomGame} 
                        className="btn" 
                        disabled={!hostedRoom.guestId}
                        style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}
                      >
                        Start Game
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      {/* Create Room */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Mins</label>
                            <input type="number" value={customMins} onChange={e => setCustomMins(e.target.value)} style={{ width: '100%', padding: '0.4rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', fontSize: '0.8rem' }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Inc</label>
                            <input type="number" value={customInc} onChange={e => setCustomInc(e.target.value)} style={{ width: '100%', padding: '0.4rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', fontSize: '0.8rem' }} />
                          </div>
                        </div>
                        <button onClick={handleCreateRoom} className="btn" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', fontSize: '0.8rem' }}>Create Room</button>
                      </div>

                      {/* Join with Code */}
                      <div style={{ flex: 1 }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Room ID</label>
                          <input 
                            type="text" 
                            placeholder="Enter Code" 
                            value={roomId} 
                            onChange={e => setRoomId(e.target.value)}
                            style={{ width: '100%', padding: '0.4rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', fontSize: '0.8rem' }}
                          />
                        </div>
                        <button onClick={handleJoinRoom} className="btn" style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem' }}>Join Room</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Open Challenges */}
                <div style={{ marginTop: '0.5rem' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                    <Users size={16} /> Open Challenges
                  </h3>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: 'normal', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Player</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: 'normal', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rating</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: 'normal', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Time</th>
                          <th style={{ padding: '0.5rem 0.75rem', fontWeight: 'normal', fontSize: '0.75rem', color: 'var(--text-secondary)' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {openSeeks.length === 0 ? (
                          <tr>
                            <td colSpan="4" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              No open challenges right now. Join the queue!
                            </td>
                          </tr>
                        ) : (
                          openSeeks.map((seek, i) => (
                            <tr key={i} className="seek-row" style={{ borderBottom: i === openSeeks.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: 'bold', fontSize: '0.85rem' }}>{seek.username}</td>
                              <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{seek.rating}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span style={{ fontSize: '0.85rem' }}>{seek.type === 'queue' ? seek.preset : `${seek.timeControlSec/60}+${seek.incrementSec}`}</span>
                                  <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.3rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                    {getTimeCategory(seek.type === 'queue' ? parseInt(seek.preset.split('+')[0]) : seek.timeControlSec / 60)}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                <button 
                                  onClick={() => handleAcceptSeek(seek)}
                                  style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}
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

        {/* Friends Online Widget */}
        <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '1.05rem' }}>
            <Users size={18} color="var(--accent-color)" /> Friends Online
          </h3>
          
          {onlineFriends.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>No friends online.</p>
              <Link to="/friends" className="btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'var(--accent-color)' }}>
                <UserPlus size={16} /> Add Friends
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {onlineFriends.slice(0, 6).map(friend => (
                <div key={friend.id} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ position: 'relative' }}>
                        <div style={{ width: '32px', height: '32px', background: 'var(--accent-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem', color: 'white' }}>
                          {friend.username.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', border: '2px solid var(--bg-color)' }}></div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{friend.username}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Rating: {friend.rating}</div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => setSelectedFriend(selectedFriend === friend.id ? null : friend.id)}
                      style={{ background: selectedFriend === friend.id ? 'rgba(255,255,255,0.1)' : 'var(--accent-color)', color: 'white', border: 'none', padding: '0.4rem 0.85rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 'bold', transition: 'all 0.2s' }}
                    >
                      <Swords size={14} /> {selectedFriend === friend.id ? 'Cancel' : 'Challenge'}
                    </button>
                  </div>
                  
                  {/* Inline Time Control Picker for Challenge */}
                  {selectedFriend === friend.id && (
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={{ width: '100%', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Time Control</div>
                      {PRESETS.map(preset => (
                        <button
                          key={preset.label}
                          onClick={() => handleChallengeFriend(friend, preset)}
                          style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.15s' }}
                          onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent-color)'; e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
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
