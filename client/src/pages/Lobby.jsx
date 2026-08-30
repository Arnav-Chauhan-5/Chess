import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import DecorativeBoard from '../components/DecorativeBoard';
import { Play, Users, Zap, Flame, Snail, Timer, Bot, Eye, BarChart2, UserPlus, Swords, Trophy, TrendingUp, Clock, Gift } from 'lucide-react';
import { getTimeCategory } from '../utils/timeControl';

const PRESETS = [
  { label: '1+0', icon: Zap },
  { label: '3+2', icon: Flame },
  { label: '5+0', icon: Flame },
  { label: '10+0', icon: Timer },
  { label: '15+10', icon: Snail }
];

const AI_BOTS = [
  { label: 'Rookie Sam', rating: 400, style: 'Beginner', difficulty: 1, color: '#3b82f6', quote: "I'm still learning how the knight moves." },
  { label: 'Pawn Pusher Vik', rating: 700, style: 'Cautious', difficulty: 2, color: '#8b5cf6', quote: "I like to keep things solid and safe." },
  { label: 'Club Regular Dee', rating: 1000, style: 'Balanced', difficulty: 3, color: '#10b981', quote: "Ready for a friendly game at the club." },
  { label: 'Tactical Rae', rating: 1300, style: 'Tactical', difficulty: 4, color: '#f59e0b', quote: "I don't like quiet positions." },
  { label: 'Iron Wall Otto', rating: 1600, style: 'Defensive', difficulty: 5, color: '#64748b', quote: "Good luck breaking through." },
  { label: 'Blitz Nova', rating: 1900, style: 'Aggressive', difficulty: 6, color: '#ef4444', quote: "Speed and attacks are all I need." },
  { label: 'Endgame Elias', rating: 2200, style: 'Precise', difficulty: 7, color: '#0ea5e9', quote: "The real game begins when the queens come off." },
  { label: 'Positional Wren', rating: 2450, style: 'Positional', difficulty: 8, color: '#14b8a6', quote: "Every pawn move creates a weakness." },
  { label: 'Chaos Theory', rating: 2650, style: 'Unpredictable', difficulty: 9, color: '#f43f5e', quote: "Order is an illusion. Embrace the chaos." },
  { label: 'The Oracle', rating: 2850, style: 'Universal', difficulty: 10, color: '#eab308', quote: "I see 20 moves deep. Your defeat is inevitable." },
];

// --- Inline SVG sparkline (no library needed) ---
function RatingSparkline({ recentGames, userId }) {
  if (!recentGames || recentGames.length < 2) return null;

  // Build cumulative rating history from newest→oldest (recentGames is newest first)
  const ordered = [...recentGames].reverse();
  const points = [];
  ordered.forEach(game => {
    const isWhite = game.whiteId === userId;
    const atGame = isWhite ? game.whiteRatingAtGame : game.blackRatingAtGame;
    const delta = isWhite ? game.whiteRatingDelta : game.blackRatingDelta;
    if (atGame != null && delta != null) {
      points.push(atGame + delta);
    }
  });

  if (points.length < 2) return null;

  const W = 200, H = 40, PAD = 4;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const toX = (i) => PAD + ((i / (points.length - 1)) * (W - PAD * 2));
  const toY = (v) => H - PAD - ((v - min) / range) * (H - PAD * 2);

  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');
  const trend = points[points.length - 1] >= points[0];
  const strokeColor = trend ? '#10b981' : '#ef4444';

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', marginTop: '0.5rem' }}>
      <polyline
        points={points.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      {/* Gradient fill under the line */}
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L ${toX(points.length - 1).toFixed(1)} ${H} L ${toX(0).toFixed(1)} ${H} Z`}
        fill="url(#spark-fill)"
      />
      {/* End dot */}
      <circle cx={toX(points.length - 1)} cy={toY(points[points.length - 1])} r="3" fill={strokeColor} />
    </svg>
  );
}

export default function Lobby() {
  const { socket } = useSocket();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const rightPanelRef = useRef(null);

  const [activeTab, setActiveTab] = useState('ai');
  const [queueStatus, setQueueStatus] = useState('idle');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [expandedBot, setExpandedBot] = useState(null);
  const [expandedAITiers, setExpandedAITiers] = useState(false);
  const [aiTimePreset, setAiTimePreset] = useState('10+0');

  const [customMins, setCustomMins] = useState(10);
  const [customInc, setCustomInc] = useState(0);
  const [roomId, setRoomId] = useState('');
  const [hostedRoom, setHostedRoom] = useState(null);

  const [openSeeks, setOpenSeeks] = useState([]);
  const [liveGames, setLiveGames] = useState([]);

  const [userStats, setUserStats] = useState(null);
  const [recentGames, setRecentGames] = useState([]);
  const [onlineFriends, setOnlineFriends] = useState([]);
  const [allFriends, setAllFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);

  const [playerSubTab, setPlayerSubTab] = useState('random');
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  // { completed: bool, rewarded: bool } — null until fetched
  const [dailyChallenge, setDailyChallenge] = useState(null);

  useEffect(() => {
    if (!socket) return;

    socket.emit('get_seeks');
    socket.emit('get_live_games');
    socket.emit('get_online_count');

    // Fetch user profile stats
    if (user) {
      fetch(`http://localhost:3000/users/profile?userId=${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.stats) {
            setUserStats(data.stats);
            setRecentGames(data.recentGames || []);
          }
        })
        .catch(err => console.error(err));

      // Fetch today's daily challenge status
      fetch(`http://localhost:3000/users/daily-challenge?userId=${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if ('completed' in data) setDailyChallenge(data);
        })
        .catch(err => console.error('daily-challenge fetch:', err));

      // Fetch friends
      fetch(`http://localhost:3000/friends/${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
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

    socket.on('online_count', (count) => {
      setOnlineCount(count);
    });

    socket.on('seeks_updated', (seeks) => {
      setOpenSeeks(seeks.filter(s => s.userId !== user?.id));
    });

    socket.on('live_games_updated', (games) => {
      setLiveGames(games);
    });

    socket.on('friend_status_changed', ({ userId, isOnline }) => {
      if (user) {
        fetch(`http://localhost:3000/friends/${user.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
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
      console.error('Socket error:', err.message);
    });

    // Real-time daily challenge completion push from server
    socket.on('daily_challenge_updated', ({ completed }) => {
      setDailyChallenge(prev => prev ? { ...prev, completed } : { completed, rewarded: false });
    });

    return () => {
      socket.off('queue_status');
      socket.off('online_count');
      socket.off('seeks_updated');
      socket.off('live_games_updated');
      socket.off('friend_status_changed');
      socket.off('match_found');
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('game_started');
      socket.off('error');
      socket.off('daily_challenge_updated');
    };
  }, [socket, navigate, hostedRoom, user]);


  const handleSearchUser = async (e) => {
    e.preventDefault();
    if (!searchUsername.trim()) return;
    setSearchError('');
    setSearchResult(null);
    try {
      const res = await fetch(`http://localhost:3000/users/search?username=${encodeURIComponent(searchUsername.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSearchResult(data.user);
    } catch (err) {
      setSearchError(err.message);
    }
  };

  const handleJoinQueue = (preset) => {
    if (!user) return navigate('/login');
    setSelectedPreset(preset.label);
    socket.emit('join_queue', { userId: user.id, username: user.username, rating: user.rating || 1200, preset: preset.label });
  };

  const handleCancelQueue = () => {
    socket.emit('leave_queue');
  };

  const handleCreateRoom = () => {
    if (!user) return navigate('/login');
    socket.emit('create_room', {
      userId: user.id,
      username: user.username,
      timeControlSec: customMins * 60,
      incrementSec: customInc
    });
  };

  const handleJoinRoom = () => {
    if (!user) return navigate('/login');
    if (!roomId) return;
    socket.emit('join_room', { roomId, userId: user.id });
  };

  const handleStartRoomGame = () => {
    if (hostedRoom) {
      socket.emit('start_game', { roomId: hostedRoom.roomId });
    }
  };

  const handleAcceptSeek = (seek) => {
    if (!user) return navigate('/login');
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
    if (!user) return navigate('/login');
    const [minStr, incStr] = aiTimePreset.split('+');
    const timeControlSec = parseInt(minStr) * 60;
    const incrementSec = parseInt(incStr);
    socket.emit('start_ai_game', {
      userId: user.id,
      difficulty: bot.difficulty,
      botName: bot.label,
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
    setStatusMessage(`Challenge sent to ${friend.username}!`);
    setTimeout(() => setStatusMessage(''), 3000);
    setSelectedFriend(null);
  };

  // Action card handler — switch tab + smooth-scroll to right panel
  const activateTab = (tab, subTab = null) => {
    setActiveTab(tab);
    if (subTab) setPlayerSubTab(subTab);
    setTimeout(() => {
      rightPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Compute stats for the stats card
  const computedStats = (() => {
    if (!userStats) return null;
    let ratingDelta = 0;
    let currentStreak = 0;
    let streakType = null;
    let streakBroken = false;

    recentGames.forEach(game => {
      const isWhite = game.whiteId === user?.id;
      const delta = isWhite ? game.whiteRatingDelta : game.blackRatingDelta;
      if (delta) ratingDelta += delta;

      if (!streakBroken) {
        const won = (isWhite && game.status === 'WHITE_WON') || (!isWhite && game.status === 'BLACK_WON');
        const lost = (isWhite && game.status === 'BLACK_WON') || (!isWhite && game.status === 'WHITE_WON');
        const draw = game.status === 'DRAW' || game.status === 'ABORTED';
        const result = won ? 'W' : lost ? 'L' : 'D';
        if (streakType === null) { streakType = result; currentStreak = 1; }
        else if (streakType === result) { currentStreak++; }
        else { streakBroken = true; }
      }
    });

    const winRate = userStats.total > 0 ? Math.round((userStats.wins / userStats.total) * 100) : 0;
    const deltaPrefix = ratingDelta > 0 ? '▲ +' : ratingDelta < 0 ? '▼ ' : '';
    const deltaColor = ratingDelta > 0 ? '#10b981' : ratingDelta < 0 ? 'var(--danger)' : 'var(--text-secondary)';

    return { ratingDelta, deltaPrefix, deltaColor, currentStreak, streakType, winRate };
  })();

  return (
    <div style={{ padding: '1rem 1.25rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Greeting Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {getGreeting()}, {user?.username || 'Player'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.25rem' }}>Ready for your next game?</p>
        </div>
        <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
          {onlineCount} Players Online
        </div>
      </div>

      {/* ── TOP ROW: Three quick-action cards ── */}
      <div className="lobby-action-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {[
          {
            id: 'new-game',
            icon: <Play size={28} />,
            title: 'New Game',
            subtitle: 'Jump into a rated match',
            gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            onClick: () => activateTab('player', 'random'),
          },
          {
            id: 'vs-bot',
            icon: <Bot size={28} />,
            title: 'Play vs Bot',
            subtitle: 'Choose your AI opponent',
            gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
            onClick: () => activateTab('ai'),
          },
          {
            id: 'vs-friend',
            icon: <UserPlus size={28} />,
            title: 'Play vs Friend',
            subtitle: 'Challenge or invite a friend',
            gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            onClick: () => navigate('/friends'),
          },
        ].map(card => (
          <button
            key={card.id}
            id={card.id}
            onClick={card.onClick}
            className="lobby-action-card"
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1.25rem 1.5rem',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Coloured icon badge */}
            <div style={{
              width: '52px', height: '52px', borderRadius: '12px',
              background: card.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', flexShrink: 0,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{card.title}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{card.subtitle}</div>
            </div>
            {/* Subtle glow accent in top-right corner */}
            <div style={{
              position: 'absolute', top: 0, right: 0,
              width: '80px', height: '80px',
              background: card.gradient,
              opacity: 0.07,
              borderRadius: '0 12px 0 80px',
              pointerEvents: 'none',
            }} />
          </button>
        ))}
      </div>

      {/* ── MAIN 3-COLUMN GRID ── */}
      <div className="lobby-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(auto, 480px) 1fr 1.1fr', gap: '1.75rem', alignItems: 'start' }}>

        {/* ════ LEFT COLUMN: Board Preview ════ */}
        <div className="lobby-board" style={{ position: 'sticky', top: '90px', maxWidth: '480px', width: '100%', margin: '0 auto' }}>
          {/* Soft radial glow behind the board */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '120%', height: '120%', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 60%)',
              zIndex: -1, pointerEvents: 'none'
            }}></div>

            {/* "Player" rows above/below board with static time badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={20} color="var(--text-secondary)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Opponent</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Waiting for game...</div>
              </div>
              {/* Static time badge — NOT a countdown */}
              <div style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '0.3rem 0.65rem',
                fontSize: '0.8rem',
                fontWeight: '700',
                color: 'var(--text-secondary)',
                letterSpacing: '0.3px',
                fontVariantNumeric: 'tabular-nums',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <Clock size={14} />
                {aiTimePreset.split('+')[0]}:00
              </div>
            </div>

            <DecorativeBoard autoplay={false} />

            {/* Your row below board */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', background: 'var(--accent-color)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', color: 'white' }}>
                {user?.username?.charAt(0)?.toUpperCase() || 'Y'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{user?.username || 'You'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{user?.rating || 1200}</div>
              </div>
              {/* Matching static time badge */}
              <div style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '0.3rem 0.65rem',
                fontSize: '0.8rem',
                fontWeight: '700',
                color: 'var(--text-secondary)',
                letterSpacing: '0.3px',
                fontVariantNumeric: 'tabular-nums',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <Clock size={14} />
                {aiTimePreset.split('+')[0]}:00
              </div>
            </div>
          </div>

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
                    className="seek-row surface-2"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.8rem 1rem',
                      textDecoration: 'none',
                      color: 'var(--text-primary)',
                      transition: 'all 0.2s',
                      fontSize: '0.85rem'
                    }}
                  >
                    <span><strong>{game.whiteUsername}</strong> vs <strong>{game.blackUsername}</strong></span>
                    <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '0.8rem' }}>Watch</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ════ MIDDLE COLUMN: Your Stats Card ════ */}
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <BarChart2 size={18} color="var(--accent-color)" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>Your Stats</h3>
            </div>

            {userStats && computedStats ? (
              <>
                {/* Rating + delta */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>Current Rating</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                    <div style={{ fontSize: '2.25rem', fontWeight: '900', color: 'var(--text-primary)', lineHeight: 1 }}>{user?.rating || 1200}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: computedStats.deltaColor }}>
                      {computedStats.deltaPrefix}{computedStats.ratingDelta !== 0 ? computedStats.ratingDelta : '±0'}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>vs last 20 games</div>
                  {/* Sparkline */}
                  <RatingSparkline recentGames={recentGames} userId={user?.id} />
                </div>

                {/* Grid of stat cells */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
                  {/* Win Rate */}
                  <div className="surface-2" style={{ padding: '0.75rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Win Rate</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{computedStats.winRate}%</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{userStats.wins}W {userStats.losses}L {userStats.draws}D</div>
                  </div>

                  {/* Games Played */}
                  <div className="surface-2" style={{ padding: '0.75rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Games Played</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{userStats.total}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>all time</div>
                  </div>

                  {/* Best Rating */}
                  <div className="surface-2" style={{ padding: '0.75rem', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>
                      <Trophy size={10} /> Best Rating
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: userStats.bestRating ? '#f59e0b' : 'var(--text-secondary)' }}>
                      {userStats.bestRating ?? '—'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                      {userStats.bestRatingDate
                        ? new Date(userStats.bestRatingDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'no data yet'}
                    </div>
                  </div>

                  {/* Current Streak */}
                  <div className="surface-2" style={{ padding: '0.75rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Streak</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem', color: computedStats.streakType === 'W' && computedStats.currentStreak >= 3 ? '#f59e0b' : computedStats.streakType === 'L' && computedStats.currentStreak >= 3 ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {computedStats.streakType === 'W' && computedStats.currentStreak >= 3 && <Flame size={16} />}
                      {computedStats.currentStreak} {computedStats.streakType || 'W'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>current</div>
                  </div>
                </div>

                {/* Recent Form dots */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>Recent Form</div>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {recentGames.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>—</span>
                    ) : (
                      recentGames.slice(0, 10).map((game, i) => {
                        const isWhite = game.whiteId === user?.id;
                        let resultColor = '#9ca3af';
                        if (game.status === 'WHITE_WON') resultColor = isWhite ? '#10b981' : 'var(--danger)';
                        if (game.status === 'BLACK_WON') resultColor = !isWhite ? '#10b981' : 'var(--danger)';
                        return (
                          <div
                            key={i}
                            title={game.status}
                            style={{ width: '14px', height: '14px', borderRadius: '3px', background: resultColor, flexShrink: 0 }}
                          />
                        );
                      })
                    )}
                  </div>
                </div>

                {/* View Full Stats link */}
                <Link
                  to="/profile"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--accent-color)',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                  }}
                  className="view-stats-link"
                >
                  <TrendingUp size={15} />
                  View Full Stats
                </Link>
              </>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
                {user ? 'Loading stats…' : 'Sign in to see your stats'}
              </div>
            )}
          </div>

          {/* ── Daily Challenge card ── */}
          {user && (
            <div className="glass-panel animate-fade-in" style={{ padding: '1.25rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '8px',
                    background: dailyChallenge?.completed
                      ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                      : 'rgba(245,158,11,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.4s',
                  }}>
                    <Gift size={16} color={dailyChallenge?.completed ? 'white' : '#f59e0b'} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Daily Challenge
                    </h3>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                      {dailyChallenge?.completed
                        ? '🎉 Challenge complete — reward awaiting!'
                        : 'Play a game to earn your daily reward!'}
                    </div>
                  </div>
                </div>
                {/* Fraction and Streak */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                  <div style={{
                    fontSize: '1rem', fontWeight: '800',
                    color: dailyChallenge?.completed ? '#f59e0b' : 'var(--text-secondary)',
                    fontVariantNumeric: 'tabular-nums',
                    transition: 'color 0.4s',
                  }}>
                    {dailyChallenge?.completed ? '1' : '0'}<span style={{ opacity: 0.5, fontWeight: '400' }}>/1</span>
                  </div>
                  
                  {/* Streak Indicator */}
                  <div style={{ 
                    fontSize: '0.7rem', 
                    color: (dailyChallenge?.streak || 0) > 0 ? '#fbbf24' : 'var(--text-secondary)', 
                    fontWeight: '600', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.2rem',
                    transition: 'color 0.4s',
                    opacity: (dailyChallenge?.streak || 0) > 0 ? 1 : 0.7
                  }}>
                    {(dailyChallenge?.streak || 0) > 0 ? '🔥' : '⏳'} {dailyChallenge?.streak || 0} {(dailyChallenge?.streak || 0) === 1 ? 'day' : 'days'} streak
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{
                height: '6px',
                borderRadius: '3px',
                background: 'rgba(255,255,255,0.08)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  borderRadius: '3px',
                  width: dailyChallenge?.completed ? '100%' : '0%',
                  background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
                  transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: dailyChallenge?.completed ? '0 0 8px rgba(245,158,11,0.6)' : 'none',
                }} />
              </div>

              {/* Loading shimmer while fetching */}
              {!dailyChallenge && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 'inherit',
                  background: 'rgba(0,0,0,0.15)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8rem', color: 'var(--text-secondary)',
                }}>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ════ RIGHT COLUMN: Opponent Tabs ════ */}
        <div ref={rightPanelRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Tab Buttons */}
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', marginBottom: '0' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
              <button style={tabStyle(activeTab === 'ai')} onClick={() => setActiveTab('ai')}>
                <Bot size={18} /> Play vs Bots
              </button>
              <button style={tabStyle(activeTab === 'player')} onClick={() => setActiveTab('player')}>
                <Users size={18} /> Play vs Players
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>

              {/* TAB 1: vs AI */}
              {activeTab === 'ai' && (
                <div className="animate-fade-in custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 'calc((4 * 84px) + (3 * 0.75rem))', overflowY: 'auto', paddingRight: '0.5rem' }}>

                  {(() => {
                    const displayBots = AI_BOTS;

                    return (
                      <>
                        {displayBots.map((bot, i) => {
                          const isExpanded = expandedBot === bot.label;
                          return (
                            <div key={bot.label} style={{ animation: `fadeIn 0.3s ease forwards ${i * 0.06}s` }}>
                              <button
                                onClick={() => setExpandedBot(isExpanded ? null : bot.label)}
                                className={`ai-bot-btn ${isExpanded ? 'surface-2' : ''}`}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  background: isExpanded ? 'var(--surface-2)' : 'transparent',
                                  border: 'none',
                                  padding: '1rem 1.25rem',
                                  height: '84px',
                                  flexShrink: 0,
                                  boxSizing: 'border-box',
                                  borderRadius: isExpanded ? '8px 8px 0 0' : '8px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  textAlign: 'left',
                                  width: '100%'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                                  <div style={{
                                    width: '40px', height: '40px', borderRadius: '50%', background: bot.color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 'bold', fontSize: '1.2rem', color: 'white', flexShrink: 0
                                  }}>
                                    {bot.label.charAt(0)}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      {bot.label}
                                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 'normal' }}>({bot.rating})</span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '0.4rem' }}>
                                      "{bot.quote}"
                                    </div>
                                    {/* Difficulty bar */}
                                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', maxWidth: '200px' }}>
                                      <div style={{ width: `${Math.min(100, (bot.rating / 2850) * 100)}%`, height: '100%', background: bot.color, borderRadius: '2px' }} />
                                    </div>
                                  </div>
                                </div>
                                <div style={{ background: 'var(--accent-color)', color: 'white', padding: '0.4rem 1rem', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                  {isExpanded ? '▾' : 'Play'}
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="surface-2" style={{
                                  borderTop: '1px solid var(--border-color)',
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
                                            padding: '0.35rem 0.65rem', borderRadius: '4px', border: '1px solid',
                                            borderColor: aiTimePreset === p.label ? 'var(--accent-color)' : 'rgba(255,255,255,0.15)',
                                            background: aiTimePreset === p.label ? 'var(--accent-color)' : 'transparent',
                                            color: 'white', cursor: 'pointer', fontSize: '0.85rem',
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
                                      <button onClick={() => handleStartAIGame(bot, 'white')} className="ai-color-btn" style={{ flex: 1, padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', transition: 'all 0.15s' }}>♔ White</button>
                                      <button onClick={() => handleStartAIGame(bot, 'random')} className="ai-color-btn" style={{ flex: 1, padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', transition: 'all 0.15s' }}>⚄ Random</button>
                                      <button onClick={() => handleStartAIGame(bot, 'black')} className="ai-color-btn" style={{ flex: 1, padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', transition: 'all 0.15s' }}>♚ Black</button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        <Link
                          to="/bots"
                          style={{
                            display: 'block', textAlign: 'center', background: 'transparent', border: '1px dashed var(--border-color)',
                            color: 'var(--text-secondary)', padding: '0.85rem', borderRadius: '8px',
                            cursor: 'pointer', transition: 'all 0.2s', marginTop: '0.25rem', textDecoration: 'none'
                          }}
                          onMouseOver={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-secondary)'; }}
                          onMouseOut={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                        >
                          View all opponents →
                        </Link>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* TAB 2: vs Player */}
              {activeTab === 'player' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                  {/* Sub-tabs */}
                  <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                    {['random', 'friend', 'search'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setPlayerSubTab(tab)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: playerSubTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent',
                          color: playerSubTab === tab ? 'white' : 'var(--text-secondary)',
                          border: 'none', borderRadius: '4px', cursor: 'pointer',
                          fontWeight: playerSubTab === tab ? 'bold' : 'normal',
                          textTransform: 'capitalize', transition: 'all 0.2s'
                        }}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {statusMessage && (
                    <div style={{ background: '#10b981', color: 'white', padding: '0.75rem', borderRadius: '4px', fontSize: '0.9rem', textAlign: 'center' }}>
                      {statusMessage}
                    </div>
                  )}

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
                                className="preset-btn surface-2"
                                style={{
                                  color: 'var(--text-primary)', display: 'flex', flexDirection: 'column',
                                  alignItems: 'center', justifyContent: 'center',
                                  padding: '1.25rem 0.75rem', cursor: 'pointer',
                                  transition: 'all 0.2s', animation: `fadeIn 0.3s ease forwards ${i * 0.05}s`
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
                      <div className="animate-fade-in custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 'calc((4 * 64px) + (3 * 0.5rem))', overflowY: 'auto', paddingRight: '0.5rem' }}>
                        {allFriends.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            No friends added yet. Try the Search tab or add friends in the Friends page.
                          </div>
                        ) : (
                          allFriends.map(friend => (
                            <div key={friend.id} className="surface-2" style={{ display: 'flex', flexDirection: 'column' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', height: '64px', flexShrink: 0, boxSizing: 'border-box' }}>
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
                          <div className="surface-2" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
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

                  {/* Invite by Link / Code */}
                  <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <h4 style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Invite by Link / Code</h4>
                    {hostedRoom ? (
                      <div>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '4px', textAlign: 'center', marginBottom: '1rem', fontFamily: 'monospace', fontSize: '1.25rem', letterSpacing: '2px', color: 'var(--accent-color)' }}>
                          {hostedRoom.roomId}
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1rem' }}>
                          {hostedRoom.guestId ? 'Opponent has joined!' : 'Waiting for opponent...'}
                        </p>
                        <button onClick={handleStartRoomGame} className="btn" disabled={!hostedRoom.guestId} style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}>
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
                              type="text" placeholder="Enter Code" value={roomId} onChange={e => setRoomId(e.target.value)}
                              style={{ width: '100%', padding: '0.4rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', fontSize: '0.8rem' }}
                            />
                          </div>
                          <button onClick={handleJoinRoom} className="btn" style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem' }}>Join Room</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Open Challenges */}
                  <div>
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
                              <tr key={i} className="seek-row surface-2" style={{ transition: 'background 0.2s' }}>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', fontSize: '0.85rem' }}>{seek.username}</td>
                                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{seek.rating}</td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.85rem' }}>{seek.type === 'queue' ? seek.preset : `${seek.timeControlSec / 60}+${seek.incrementSec}`}</span>
                                    <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.3rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                      {getTimeCategory(seek.type === 'queue' ? parseInt(seek.preset.split('+')[0]) : seek.timeControlSec / 60)}
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                  <button
                                    onClick={() => handleAcceptSeek(seek)}
                                    className="btn"
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: 'auto' }}
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

          {/* ── Recent Activity card ── */}
          <div className="glass-panel animate-fade-in" style={{ padding: '1.25rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} color="var(--accent-color)" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700' }}>Recent Activity</h3>
              </div>
              <Link
                to="/history"
                style={{ fontSize: '0.75rem', color: 'var(--accent-color)', textDecoration: 'none', fontWeight: '600' }}
              >
                View all
              </Link>
            </div>

            {/* Game rows — capped at 3 on this page */}
            {recentGames.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
                No games yet — play one!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {recentGames.slice(0, 3).map((game, idx) => {
                  const isWhite = game.whiteId === user?.id;

                  // Opponent name
                  let oppName = isWhite
                    ? game.blackPlayer?.username
                    : game.whitePlayer?.username;
                  if (game.vsAI) oppName = game.aiPersonaName || 'AI';
                  else if (!oppName) oppName = 'Unknown';

                  // Outcome phrase + colours
                  let phrase, outcomeColor, dotColor;
                  const won =
                    (isWhite && game.status === 'WHITE_WON') ||
                    (!isWhite && game.status === 'BLACK_WON');
                  const lost =
                    (isWhite && game.status === 'BLACK_WON') ||
                    (!isWhite && game.status === 'WHITE_WON');

                  if (won) {
                    phrase = `You won against ${oppName}`;
                    outcomeColor = '#10b981';
                    dotColor = '#10b981';
                  } else if (lost) {
                    phrase = `You were beat by ${oppName}`;
                    outcomeColor = 'var(--danger)';
                    dotColor = '#ef4444';
                  } else {
                    phrase = `Draw with ${oppName}`;
                    outcomeColor = 'var(--text-secondary)';
                    dotColor = '#9ca3af';
                  }

                  // Rating delta
                  const delta = isWhite ? game.whiteRatingDelta : game.blackRatingDelta;
                  const deltaText =
                    delta == null ? null
                      : delta > 0 ? `+${delta}`
                        : delta < 0 ? `${delta}`
                          : '0';
                  const deltaColor =
                    delta > 0 ? '#10b981'
                      : delta < 0 ? 'var(--danger)'
                        : 'var(--text-secondary)';

                  // Relative timestamp
                  const relTime = (() => {
                    const ts = new Date(game.endedAt || game.createdAt);
                    const diffMs = Date.now() - ts.getTime();
                    const mins = Math.floor(diffMs / 60000);
                    if (mins < 1) return 'just now';
                    if (mins < 60) return `${mins}m ago`;
                    const hrs = Math.floor(mins / 60);
                    if (hrs < 24) return `${hrs}h ago`;
                    const days = Math.floor(hrs / 24);
                    if (days < 7) return `${days}d ago`;
                    return ts.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  })();

                  // Opponent initial for avatar
                  const oppInitial = oppName.charAt(0).toUpperCase();

                  return (
                    <div
                      key={game.id}
                      className="activity-row"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.65rem 0.5rem',
                        borderBottom: idx < Math.min(recentGames.length, 3) - 1
                          ? '1px solid rgba(255,255,255,0.04)'
                          : 'none',
                        transition: 'background 0.15s',
                        borderRadius: '6px',
                        cursor: 'default',
                      }}
                    >
                      {/* Outcome dot + opponent avatar */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '50%',
                          background: 'var(--surface-2)',
                          border: `2px solid ${dotColor}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)',
                        }}>
                          {oppInitial}
                        </div>
                        {/* Small outcome pip */}
                        <div style={{
                          position: 'absolute', bottom: -1, right: -1,
                          width: '10px', height: '10px', borderRadius: '50%',
                          background: dotColor,
                          border: '2px solid var(--surface-1)',
                        }} />
                      </div>

                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.82rem',
                          fontWeight: '600',
                          color: outcomeColor,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {phrase}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                          {relTime}
                        </div>
                      </div>

                      {/* Rating delta */}
                      {deltaText != null && (
                        <div style={{
                          fontSize: '0.85rem',
                          fontWeight: '800',
                          color: deltaColor,
                          flexShrink: 0,
                          minWidth: '36px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {deltaText}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {/* ── End right column ── */}

      </div>{/* ── End lobby-grid ── */}

      <style>{`
        .lobby-action-card:hover {
          border-color: rgba(255,255,255,0.2) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        .activity-row:hover {
          background: rgba(255,255,255,0.03) !important;
        }
        .view-stats-link:hover {
          background: rgba(59,130,246,0.1) !important;
          border-color: var(--accent-color) !important;
        }
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

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        @media (max-width: 1100px) {
          .lobby-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .lobby-board {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 700px) {
          .lobby-action-row {
            grid-template-columns: 1fr !important;
          }
          .lobby-grid {
            grid-template-columns: 1fr !important;
          }
          .lobby-board {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}
