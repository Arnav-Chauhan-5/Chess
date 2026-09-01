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
  { label: 'Rookie Sam', rating: 400, style: 'Beginner', difficulty: 1, color: '#3b82f6', avatar: '/avatars/bot_rookie_sam_1788108534537.jpg', quote: "I'm still learning how the knight moves." },
  { label: 'Pawn Pusher Vik', rating: 700, style: 'Cautious', difficulty: 2, color: '#8b5cf6', avatar: '/avatars/bot_pawn_vik_1788108546050.jpg', quote: "I like to keep things solid and safe." },
  { label: 'Club Regular Dee', rating: 1000, style: 'Balanced', difficulty: 3, color: '#10b981', avatar: '/avatars/bot_club_dee_1788108557391.jpg', quote: "Ready for a friendly game at the club." },
  { label: 'Tactical Rae', rating: 1300, style: 'Tactical', difficulty: 4, color: '#f59e0b', avatar: '/avatars/bot_tactical_rae_1788108582334.jpg', quote: "I don't like quiet positions." },
  { label: 'Iron Wall Otto', rating: 1600, style: 'Defensive', difficulty: 5, color: '#64748b', avatar: '/avatars/bot_iron_otto_1788108598243.jpg', quote: "Good luck breaking through." },
  { label: 'Blitz Nova', rating: 1900, style: 'Aggressive', difficulty: 6, color: '#ef4444', avatar: '/avatars/bot_blitz_nova_1788108610527.jpg', quote: "Speed and attacks are all I need." },
  { label: 'Endgame Elias', rating: 2200, style: 'Precise', difficulty: 7, color: '#0ea5e9', avatar: '/avatars/bot_endgame_elias_1788108620972.jpg', quote: "The real game begins when the queens come off." },
  { label: 'Positional Wren', rating: 2450, style: 'Positional', difficulty: 8, color: '#14b8a6', avatar: '/avatars/bot_positional_wren_1788108631085.jpg', quote: "Every pawn move creates a weakness." },
  { label: 'Chaos Theory', rating: 2650, style: 'Unpredictable', difficulty: 9, color: '#f43f5e', avatar: '/avatars/bot_chaos_theory_1788108644422.jpg', quote: "Order is an illusion. Embrace the chaos." },
  { label: 'The Oracle', rating: 2850, style: 'Universal', difficulty: 10, color: '#eab308', avatar: '/avatars/bot_oracle_1788108656227.jpg', quote: "I see 20 moves deep. Your defeat is inevitable." },
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
  const strokeColor = trend ? 'var(--color-win)' : 'var(--color-loss)';

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
            setUserStats({ ...data.stats, rating: data.user?.rating });
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
    padding: '10px 16px',
    background: isActive ? 'rgba(59,76,122,0.06)' : 'transparent',
    border: 'none',
    borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
    color: isActive ? 'var(--primary)' : 'var(--on-surface-variant)',
    cursor: 'pointer',
    fontWeight: isActive ? '600' : '400',
    fontSize: '13px',
    fontFamily: 'var(--font-sans)',
    transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
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
    const deltaColor = ratingDelta > 0 ? 'var(--color-win)' : ratingDelta < 0 ? 'var(--color-loss)' : 'var(--on-surface-variant)';

    return { ratingDelta, deltaPrefix, deltaColor, currentStreak, streakType, winRate };
  })();

  return (
    <div style={{ padding: '16px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Greeting Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '600', margin: 0, letterSpacing: '-0.02em', color: 'var(--on-surface)', fontFamily: 'var(--font-sans)' }}>
            {getGreeting()}, {user?.username || 'Player'}
          </h1>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '16px', marginTop: '4px' }}>Ready for your next game?</p>
        </div>
        <div style={{ color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginBottom: '2px' }}>
          <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: 'var(--stats-win)', flexShrink: 0 }}></span>
          {onlineCount} Players Online
        </div>
      </div>

      {/* ── TOP ROW: Three quick-action cards ── */}
      <div className="lobby-action-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {[
          {
            id: 'new-game',
            icon: <Play size={22} />,
            title: 'New Game',
            subtitle: 'Jump into a rated match',
            onClick: () => activateTab('player', 'random'),
          },
          {
            id: 'vs-bot',
            icon: <Bot size={22} />,
            title: 'Play vs Bot',
            subtitle: 'Choose your AI opponent',
            onClick: () => activateTab('ai'),
          },
          {
            id: 'vs-friend',
            icon: <UserPlus size={22} />,
            title: 'Play vs Friend',
            subtitle: 'Challenge or invite a friend',
            onClick: () => navigate('/friends'),
          },
        ].map(card => (
          <button
            key={card.id}
            id={card.id}
            onClick={card.onClick}
            className="lobby-action-card"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '14px 16px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'background 0.15s ease, border-color 0.15s ease',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {/* Icon badge */}
            <div className="action-icon" style={{
              width: '40px', height: '40px', borderRadius: '4px',
              background: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--on-primary)', flexShrink: 0,
              transition: 'background 0.15s ease, color 0.15s ease'
            }}>
              {card.icon}
            </div>
            <div>
              <div className="action-title" style={{ fontWeight: '600', fontSize: '14px', color: 'var(--on-surface)', marginBottom: '2px', transition: 'color 0.15s ease' }}>{card.title}</div>
              <div className="action-subtitle" style={{ fontSize: '13px', color: 'var(--on-surface-variant)', transition: 'color 0.15s ease' }}>{card.subtitle}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ── MAIN 3-COLUMN GRID ── */}
      <div className="lobby-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(auto, 440px) 1fr 1.1fr', gap: '16px', alignItems: 'start' }}>

        {/* ════ LEFT COLUMN: Board Preview ════ */}
        <div className="lobby-board" style={{ position: 'sticky', top: '76px', maxWidth: '440px', width: '100%', margin: '0 auto' }}>
          <div style={{ position: 'relative' }}>

            {/* Opponent row above board */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '8px', background: 'rgba(27,27,31,0.04)', borderRadius: '4px' }}>
              <div style={{ width: '32px', height: '32px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={17} color="var(--on-surface-variant)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '500', fontSize: '14px', color: 'var(--on-surface)' }}>Opponent</div>
                <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>Waiting for game...</div>
              </div>
              {/* Static time badge — NOT a countdown */}
              <div style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--on-surface-variant)',
                fontVariantNumeric: 'tabular-nums',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <Clock size={12} />
                {aiTimePreset.split('+')[0]}:00
              </div>
            </div>

            <DecorativeBoard autoplay={false} />

            {/* Your row below board */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '8px', background: 'rgba(27,27,31,0.04)', borderRadius: '4px' }}>
              <div style={{ width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '14px', color: 'var(--on-primary)' }}>
                {user?.username?.charAt(0)?.toUpperCase() || 'Y'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '500', fontSize: '14px', color: 'var(--on-surface)' }}>{user?.username || 'You'}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--on-surface-variant)', fontVariantNumeric: 'tabular-nums' }}>{user?.rating || 1200}</div>
              </div>
              {/* Matching static time badge */}
              <div style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--on-surface-variant)',
                fontVariantNumeric: 'tabular-nums',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <Clock size={12} />
                {aiTimePreset.split('+')[0]}:00
              </div>
            </div>
          </div>

          {/* Live Games below the board */}
          {liveGames.length > 0 && (
            <div className="glass-panel animate-fade-in" style={{ padding: '12px', marginTop: '12px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--on-surface)' }}>
                <Eye size={14} color="var(--primary)" /> Live Games
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {liveGames.map((game, i) => (
                  <Link
                    key={i}
                    to={`/game/${game.gameId}`}
                    className="seek-row surface-2"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      textDecoration: 'none',
                      color: 'var(--on-surface)',
                      transition: 'background 0.15s ease',
                      fontSize: '13px',
                      borderRadius: '4px',
                    }}
                  >
                    <span><strong>{game.whiteUsername}</strong> vs <strong>{game.blackUsername}</strong></span>
                    <span style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '12px' }}>Watch</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ════ MIDDLE COLUMN: Your Stats Card ════ */}
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="glass-panel" style={{ padding: '16px' }}>
            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
              <BarChart2 size={15} color="var(--primary)" />
              <h3 className="label-caps" style={{ margin: 0, color: 'var(--on-surface-variant)' }}>Your Stats</h3>
            </div>

            {userStats && computedStats ? (
              <>
                {/* Rating + delta */}
                <div style={{ marginBottom: '14px' }}>
                  <div className="label-caps" style={{ marginBottom: '4px' }}>Current Rating</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '32px', fontWeight: '600', color: 'var(--on-surface)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {userStats.rating ?? user?.rating ?? 1200}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: computedStats.deltaColor, fontFamily: 'var(--font-mono)' }}>
                      {computedStats.deltaPrefix}{computedStats.ratingDelta !== 0 ? computedStats.ratingDelta : '±0'}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>vs last 20 games</div>
                  {/* Sparkline */}
                  <RatingSparkline recentGames={recentGames} userId={user?.id} />
                </div>

                {/* Grid of stat cells */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                  {/* Win Rate */}
                  <div className="surface-2" style={{ padding: '10px 12px' }}>
                    <div className="label-caps" style={{ marginBottom: '4px' }}>Win Rate</div>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--on-surface)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{computedStats.winRate}%</div>
                    <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
                      <span style={{ color: 'var(--stats-win)', fontWeight: '500' }}>{userStats.wins}W</span>
                      {' '}
                      <span style={{ color: 'var(--color-loss)', fontWeight: '500' }}>{userStats.losses}L</span>
                      {' '}
                      <span style={{ color: 'var(--stats-draw)', fontWeight: '500' }}>{userStats.draws}D</span>
                    </div>
                  </div>

                  {/* Games Played */}
                  <div className="surface-2" style={{ padding: '10px 12px' }}>
                    <div className="label-caps" style={{ marginBottom: '4px' }}>Games Played</div>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--on-surface)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{userStats.total}</div>
                    <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>ranked matches</div>
                  </div>

                  {/* Best Rating */}
                  <div className="surface-2" style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                      <Trophy size={9} color="var(--stats-gold)" />
                      <span className="label-caps">Best Rating</span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: userStats.bestRating ? 'var(--stats-gold)' : 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                      {userStats.bestRating ?? '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
                      {userStats.bestRatingDate
                        ? new Date(userStats.bestRatingDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'no data yet'}
                    </div>
                  </div>

                  {/* Current Streak */}
                  <div className="surface-2" style={{ padding: '10px 12px' }}>
                    <div className="label-caps" style={{ marginBottom: '4px' }}>Streak</div>
                    <div style={{ fontSize: '20px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: computedStats.streakType === 'W' && computedStats.currentStreak >= 3 ? 'var(--stats-gold)' : computedStats.streakType === 'L' && computedStats.currentStreak >= 3 ? 'var(--color-loss)' : 'var(--on-surface)' }}>
                      {computedStats.streakType === 'W' && computedStats.currentStreak >= 3 && <Flame size={16} />}
                      {computedStats.currentStreak} {computedStats.streakType || 'W'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>current</div>
                  </div>
                </div>

                {/* Recent Form dots */}
                <div style={{ marginBottom: '14px' }}>
                  <div className="label-caps" style={{ marginBottom: '6px' }}>Recent Form</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {recentGames.length === 0 ? (
                      <span style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>—</span>
                    ) : (
                      recentGames.slice(0, 10).map((game, i) => {
                        const isWhite = game.whiteId === user?.id;
                        let resultColor = 'var(--stats-draw)';
                        if (game.status === 'WHITE_WON') resultColor = isWhite ? 'var(--color-win)' : 'var(--color-loss)';
                        if (game.status === 'BLACK_WON') resultColor = !isWhite ? 'var(--color-win)' : 'var(--color-loss)';
                        return (
                          <div
                            key={i}
                            title={game.status}
                            style={{ width: '12px', height: '12px', borderRadius: '2px', background: resultColor, flexShrink: 0 }}
                          />
                        );
                      })
                    )}
                  </div>
                </div>

                {userStats.casualTotal > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', textAlign: 'center', marginBottom: '12px' }}>
                    + {userStats.casualTotal} casual / AI {userStats.casualTotal === 1 ? 'game' : 'games'} played
                  </div>
                )}

                {/* View Full Stats link */}
                <Link
                  to="/profile"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--primary)',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'background 0.15s ease',
                  }}
                  className="view-stats-link"
                >
                  <TrendingUp size={14} />
                  View Full Stats
                </Link>
              </>
            ) : (
              <div style={{ color: 'var(--on-surface-variant)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
                {user ? 'Loading stats…' : 'Sign in to see your stats'}
              </div>
            )}
          </div>

          {/* ── Daily Challenge card ── */}
          {user && (
            <div className="glass-panel animate-fade-in" style={{ padding: '14px', position: 'relative' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '4px',
                    background: dailyChallenge?.completed
                      ? 'var(--stats-gold)'
                      : 'rgba(184,134,11,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.4s',
                  }}>
                    <Gift size={15} color={dailyChallenge?.completed ? 'white' : 'var(--stats-gold)'} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--on-surface)' }}>
                      Daily Challenge
                    </h3>
                    <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
                      {dailyChallenge?.completed
                        ? '🎉 Challenge complete — reward awaiting!'
                        : 'Play a game to earn your daily reward!'}
                    </div>
                  </div>
                </div>
                {/* Fraction and Streak */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px', fontWeight: '600',
                    color: dailyChallenge?.completed ? 'var(--stats-gold)' : 'var(--on-surface-variant)',
                    fontVariantNumeric: 'tabular-nums',
                    transition: 'color 0.4s',
                  }}>
                    {dailyChallenge?.completed ? '1' : '0'}<span style={{ opacity: 0.5, fontWeight: '400' }}>/1</span>
                  </div>

                  {/* Streak Indicator */}
                  <div style={{
                    fontSize: '11px',
                    color: (dailyChallenge?.streak || 0) > 0 ? 'var(--stats-gold)' : 'var(--on-surface-variant)',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    transition: 'color 0.4s',
                    opacity: (dailyChallenge?.streak || 0) > 0 ? 1 : 0.7,
                  }}>
                    {(dailyChallenge?.streak || 0) > 0 ? '🔥' : '⏳'} {dailyChallenge?.streak || 0} {(dailyChallenge?.streak || 0) === 1 ? 'day' : 'days'} streak
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{
                height: '4px',
                borderRadius: '2px',
                background: 'rgba(27,27,31,0.08)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  borderRadius: '2px',
                  width: dailyChallenge?.completed ? '100%' : '0%',
                  background: 'var(--stats-gold)',
                  transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }} />
              </div>

              {/* Loading shimmer while fetching */}
              {!dailyChallenge && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 'inherit',
                  background: 'rgba(237,239,241,0.6)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', color: 'var(--on-surface-variant)',
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
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              <button style={tabStyle(activeTab === 'ai')} onClick={() => setActiveTab('ai')}>
                <Bot size={18} /> Play vs Bots
              </button>
              <button style={tabStyle(activeTab === 'player')} onClick={() => setActiveTab('player')}>
                <Users size={18} /> Play vs Players
              </button>
            </div>

            <div style={{ padding: '12px' }}>

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
                                  background: isExpanded ? 'var(--bg)' : 'transparent',
                                  border: isExpanded ? '1px solid var(--border)' : 'none',
                                  padding: '10px 12px',
                                  height: '80px',
                                  flexShrink: 0,
                                  boxSizing: 'border-box',
                                  borderRadius: isExpanded ? '4px 4px 0 0' : '4px',
                                  cursor: 'pointer',
                                  transition: 'background 0.15s ease',
                                  textAlign: 'left',
                                  width: '100%',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                                  <div className="bot-avatar-inner" style={{
                                    width: '38px', height: '38px', borderRadius: '50%', background: bot.color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: '600', fontSize: '1.1rem', color: 'white', flexShrink: 0,
                                    overflow: 'hidden', position: 'relative'
                                  }}>
                                    <span style={{ position: 'absolute' }}>{bot.label.charAt(0)}</span>
                                    {bot.avatar && (
                                      <img 
                                        src={bot.avatar} 
                                        alt={bot.label} 
                                        className="bot-avatar-img"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 1 }} 
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                      />
                                    )}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--on-surface)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      {bot.label}
                                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--on-surface-variant)', fontSize: '12px', fontWeight: '400', fontVariantNumeric: 'tabular-nums' }}>({bot.rating})</span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', fontStyle: 'italic', marginBottom: '4px' }}>
                                      "{bot.quote}"
                                    </div>
                                    {/* Difficulty bar */}
                                    <div style={{ width: '100%', height: '3px', background: 'rgba(27,27,31,0.1)', borderRadius: '2px', overflow: 'hidden', maxWidth: '160px' }}>
                                      <div style={{ width: `${Math.min(100, (bot.rating / 2850) * 100)}%`, height: '100%', background: bot.color, borderRadius: '2px' }} />
                                    </div>
                                  </div>
                                </div>
                                <div style={{ background: 'var(--primary)', color: 'var(--on-primary)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', transition: 'background 0.15s ease', fontFamily: 'var(--font-sans)' }}>
                                  {isExpanded ? '▾' : 'Play'}
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="surface-2" style={{
                                  borderTop: '1px solid var(--border)',
                                  borderRadius: '0 0 4px 4px',
                                  padding: '10px 12px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px',
                                }}>
                                  {/* Time control */}
                                  <div>
                                    <div className="label-caps" style={{ marginBottom: '6px' }}>Time Control</div>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                      {PRESETS.map(p => (
                                        <button
                                          key={p.label}
                                          onClick={() => setAiTimePreset(p.label)}
                                          style={{
                                            padding: '4px 8px', borderRadius: '4px', border: '1px solid',
                                            borderColor: aiTimePreset === p.label ? 'var(--primary)' : 'var(--border)',
                                            background: aiTimePreset === p.label ? 'var(--primary)' : 'var(--surface)',
                                            color: aiTimePreset === p.label ? 'var(--on-primary)' : 'var(--on-surface)',
                                            cursor: 'pointer', fontSize: '12px',
                                            fontWeight: aiTimePreset === p.label ? '600' : '400',
                                            fontFamily: 'var(--font-sans)',
                                            transition: 'all 0.15s',
                                          }}
                                        >{p.label}</button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Color choice */}
                                  <div>
                                    <div className="label-caps" style={{ marginBottom: '6px' }}>Play As</div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                      <button onClick={() => handleStartAIGame(bot, 'white')} className="ai-color-btn" style={{ flex: 1, padding: '7px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--on-surface)', cursor: 'pointer', fontWeight: '500', fontSize: '12px', fontFamily: 'var(--font-sans)', transition: 'background 0.15s ease' }}>♔ White</button>
                                      <button onClick={() => handleStartAIGame(bot, 'random')} className="ai-color-btn" style={{ flex: 1, padding: '7px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--on-surface-variant)', cursor: 'pointer', fontWeight: '500', fontSize: '12px', fontFamily: 'var(--font-sans)', transition: 'background 0.15s ease' }}>⚄ Random</button>
                                      <button onClick={() => handleStartAIGame(bot, 'black')} className="ai-color-btn" style={{ flex: 1, padding: '7px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--on-surface)', color: 'var(--bg)', cursor: 'pointer', fontWeight: '500', fontSize: '12px', fontFamily: 'var(--font-sans)', transition: 'background 0.15s ease' }}>♚ Black</button>
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
                            display: 'block', textAlign: 'center',
                            background: 'transparent',
                            border: '1px dashed var(--border)',
                            color: 'var(--on-surface-variant)',
                            padding: '10px', borderRadius: '4px',
                            cursor: 'pointer', transition: 'background 0.15s ease, color 0.15s ease',
                            marginTop: '4px', textDecoration: 'none',
                            fontSize: '13px',
                          }}
                          className="view-all-bots-link"
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
                  <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                    {['random', 'friend', 'search'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setPlayerSubTab(tab)}
                        style={{
                          padding: '5px 10px',
                          background: playerSubTab === tab ? 'rgba(59,76,122,0.08)' : 'transparent',
                          color: playerSubTab === tab ? 'var(--primary)' : 'var(--on-surface-variant)',
                          border: 'none', borderRadius: '4px', cursor: 'pointer',
                          fontWeight: playerSubTab === tab ? '600' : '400',
                          fontSize: '12px',
                          textTransform: 'capitalize',
                          transition: 'background 0.15s ease, color 0.15s ease',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {statusMessage && (
                    <div style={{ background: 'var(--color-win)', color: '#000', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', textAlign: 'center' }}>
                      {statusMessage}
                    </div>
                  )}

                  <div style={{ minHeight: '180px' }}>

                    {/* RANDOM TAB */}
                    {playerSubTab === 'random' && (
                      <div className="animate-fade-in">
                        {queueStatus === 'searching' ? (
                          <div style={{ textAlign: 'center', padding: '24px 12px', background: 'var(--bg)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--on-surface)' }}>Searching for opponent...</div>
                            <p style={{ color: 'var(--primary)', marginBottom: '16px', fontSize: '16px', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{selectedPreset}</p>
                            <button onClick={handleCancelQueue} className="btn" style={{ padding: '0 20px', background: 'var(--color-loss)' }}>
                              Cancel Search
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '6px' }}>
                            {PRESETS.map((preset, i) => (
                              <button
                                key={preset.label}
                                onClick={() => handleJoinQueue(preset)}
                                className="preset-btn surface-2"
                                style={{
                                  color: 'var(--on-surface)', display: 'flex', flexDirection: 'column',
                                  alignItems: 'center', justifyContent: 'center',
                                  padding: '14px 8px', cursor: 'pointer',
                                  transition: 'background 0.15s ease, border-color 0.15s ease',
                                  animation: `fadeIn 0.3s ease forwards ${i * 0.05}s`,
                                }}
                              >
                                <preset.icon size={20} style={{ marginBottom: '6px', color: 'var(--on-surface-variant)' }} className="preset-icon" />
                                <span style={{ fontSize: '14px', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{preset.label}</span>
                                <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
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
                      <div className="animate-fade-in custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: 'calc((4 * 60px) + (3 * 4px))', overflowY: 'auto', paddingRight: '4px' }}>
                        {allFriends.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--on-surface-variant)', fontSize: '13px' }}>
                            No friends added yet. Try the Search tab or add friends in the Friends page.
                          </div>
                        ) : (
                          allFriends.map(friend => (
                            <div key={friend.id} className="surface-2" style={{ display: 'flex', flexDirection: 'column' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', height: '60px', flexShrink: 0, boxSizing: 'border-box' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ position: 'relative' }}>
                                    <div style={{ width: '28px', height: '28px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '12px', color: 'var(--on-primary)' }}>
                                      {friend.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ position: 'absolute', bottom: -2, right: -2, width: '9px', height: '9px', borderRadius: '50%', background: friend.isOnline ? 'var(--stats-win)' : 'var(--stats-draw)', border: '2px solid var(--bg)' }}></div>
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: '500', fontSize: '13px', color: 'var(--on-surface)' }}>{friend.username}</div>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--on-surface-variant)', fontVariantNumeric: 'tabular-nums' }}>{friend.rating}</div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => setSelectedFriend(selectedFriend === friend.id ? null : friend.id)}
                                  style={{ background: selectedFriend === friend.id ? 'var(--bg)' : 'var(--primary)', color: selectedFriend === friend.id ? 'var(--on-surface-variant)' : 'white', border: selectedFriend === friend.id ? '1px solid var(--border)' : 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', fontFamily: 'var(--font-sans)', transition: 'background 0.15s ease' }}
                                >
                                  {selectedFriend === friend.id ? 'Cancel' : 'Challenge'}
                                </button>
                              </div>

                              {selectedFriend === friend.id && (
                                <div style={{ padding: '6px 10px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {PRESETS.map(preset => (
                                    <button
                                      key={preset.label}
                                      onClick={() => handleChallengeFriend(friend, preset)}
                                      className="preset-challenge-btn"
                                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--on-surface)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)', transition: 'background 0.15s ease' }}
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
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <form onSubmit={handleSearchUser} style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            placeholder="Search username to challenge..."
                            value={searchUsername}
                            onChange={e => setSearchUsername(e.target.value)}
                            style={{ flex: 1, padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--on-surface)', borderRadius: '4px', outline: 'none', fontSize: '13px' }}
                          />
                          <button type="submit" className="btn" style={{ padding: '0 14px', fontSize: '13px' }}>Find</button>
                        </form>

                        {searchError && <div style={{ color: 'var(--color-loss)', fontSize: '13px' }}>{searchError}</div>}

                        {searchResult && (
                          <div className="surface-2" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ position: 'relative' }}>
                                  <div style={{ width: '30px', height: '30px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '13px', color: 'var(--on-primary)' }}>
                                    {searchResult.username.charAt(0).toUpperCase()}
                                  </div>
                                  <div style={{ position: 'absolute', bottom: -2, right: -2, width: '9px', height: '9px', borderRadius: '50%', background: searchResult.showOnlineStatus ? 'var(--stats-win)' : 'var(--stats-draw)', border: '2px solid var(--bg)' }}></div>
                                </div>
                                <div>
                                  <div style={{ fontWeight: '500', fontSize: '13px', color: 'var(--on-surface)' }}>{searchResult.username}</div>
                                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--on-surface-variant)', fontVariantNumeric: 'tabular-nums' }}>Rating: {searchResult.rating}</div>
                                </div>
                              </div>
                              <button
                                onClick={() => setSelectedFriend(selectedFriend === searchResult.id ? null : searchResult.id)}
                                style={{ background: selectedFriend === searchResult.id ? 'var(--bg)' : 'var(--primary)', color: selectedFriend === searchResult.id ? 'var(--on-surface-variant)' : 'white', border: selectedFriend === searchResult.id ? '1px solid var(--border)' : 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: 'var(--font-sans)', transition: 'background 0.15s ease' }}
                              >
                                {selectedFriend === searchResult.id ? 'Cancel' : 'Challenge'}
                              </button>
                            </div>

                            {selectedFriend === searchResult.id && (
                              <div style={{ padding: '6px 10px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {PRESETS.map(preset => (
                                  <button
                                    key={preset.label}
                                    onClick={() => handleChallengeFriend(searchResult, preset)}
                                    className="preset-challenge-btn"
                                    style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--on-surface)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)', transition: 'background 0.15s ease' }}
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
                          <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                            <th style={{ padding: '6px 10px', fontWeight: '500', fontSize: '11px', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Player</th>
                            <th style={{ padding: '6px 10px', fontWeight: '500', fontSize: '11px', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Rating</th>
                            <th style={{ padding: '6px 10px', fontWeight: '500', fontSize: '11px', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Time</th>
                            <th style={{ padding: '6px 10px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {openSeeks.length === 0 ? (
                            <tr>
                              <td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: '13px' }}>
                                No open challenges right now. Join the queue!
                              </td>
                            </tr>
                          ) : (
                            openSeeks.map((seek, i) => (
                              <tr key={i} className="seek-row" style={{ transition: 'background 0.15s ease' }}>
                                <td style={{ padding: '8px 10px', fontWeight: '500', fontSize: '13px', color: 'var(--on-surface)' }}>{seek.username}</td>
                                <td style={{ padding: '8px 10px', color: 'var(--on-surface-variant)', fontSize: '13px', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{seek.rating}</td>
                                <td style={{ padding: '8px 10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{seek.type === 'queue' ? seek.preset : `${seek.timeControlSec / 60}+${seek.incrementSec}`}</span>
                                    <span style={{ fontSize: '10px', padding: '1px 4px', background: 'rgba(27,27,31,0.06)', borderRadius: '2px', color: 'var(--on-surface-variant)' }}>
                                      {getTimeCategory(seek.type === 'queue' ? parseInt(seek.preset.split('+')[0]) : seek.timeControlSec / 60)}
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                  <button
                                    onClick={() => handleAcceptSeek(seek)}
                                    className="btn"
                                    style={{ padding: '0 10px', fontSize: '12px', height: '28px' }}
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
          <div className="glass-panel animate-fade-in" style={{ padding: '14px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} color="var(--primary)" />
                <h3 className="label-caps" style={{ margin: 0, color: 'var(--on-surface-variant)' }}>Recent Activity</h3>
              </div>
              <Link
                to="/history"
                style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none', fontWeight: '600' }}
              >
                View all
              </Link>
            </div>

            {/* Game rows — capped at 3 on this page */}
            {recentGames.length === 0 ? (
              <div style={{ color: 'var(--on-surface-variant)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                No games yet — play one!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {recentGames.slice(0, 2).map((game, idx) => {
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
                    outcomeColor = 'var(--color-win)';
                    dotColor = 'var(--color-win)';
                  } else if (lost) {
                    phrase = `You were beat by ${oppName}`;
                    outcomeColor = 'var(--color-loss)';
                    dotColor = 'var(--color-loss)';
                  } else {
                    phrase = `Draw with ${oppName}`;
                    outcomeColor = 'var(--stats-draw)';
                    dotColor = 'var(--stats-draw)';
                  }

                  // Rating delta
                  const delta = isWhite ? game.whiteRatingDelta : game.blackRatingDelta;
                  
                  let deltaText, deltaColor;
                  
                  if (game.isCasual) {
                    deltaText = 'Casual';
                    deltaColor = 'var(--on-surface-variant)';
                  } else {
                    deltaText = delta == null ? null
                      : delta > 0 ? `+${delta}`
                        : delta < 0 ? `${delta}`
                          : '0';
                    deltaColor = delta > 0 ? 'var(--color-win)'
                      : delta < 0 ? 'var(--color-loss)'
                        : 'var(--on-surface-variant)';
                  }

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
                        gap: '10px',
                        padding: '10px 6px',
                        borderBottom: idx < Math.min(recentGames.length, 2) - 1
                          ? '1px solid var(--border)'
                          : 'none',
                        transition: 'background 0.15s ease',
                        borderRadius: '4px',
                        cursor: 'default',
                      }}
                    >
                      {/* Outcome dot + opponent avatar */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: 'var(--bg)',
                          border: `2px solid ${dotColor}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '600', fontSize: '13px', color: 'var(--on-surface)',
                        }}>
                          {oppInitial}
                        </div>
                        {/* Small outcome pip */}
                        <div style={{
                          position: 'absolute', bottom: -1, right: -1,
                          width: '9px', height: '9px', borderRadius: '50%',
                          background: dotColor,
                          border: '2px solid var(--surface)',
                        }} />
                      </div>

                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: outcomeColor,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {phrase}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
                          {relTime}
                        </div>
                      </div>

                      {/* Rating delta */}
                      {deltaText != null && (
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '700',
                          color: deltaColor,
                          flexShrink: 0,
                          minWidth: '32px',
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
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
        /* ── Lobby hover states: Onyx Inversion ── */
        .lobby-action-card:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
        }

        .activity-row:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }

        .view-stats-link:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }

        .preset-btn:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
        }

        .ai-bot-btn:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
        }

        .ai-color-btn:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
        }

        .seek-row:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }

        .preset-challenge-btn:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
        }

        .view-all-bots-link:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          color: var(--on-surface) !important;
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
