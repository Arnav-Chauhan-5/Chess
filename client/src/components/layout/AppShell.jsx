import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { useSettings } from '../../context/SettingsContext';
import { Play, Trophy, History, User as UserIcon, Settings, LogOut, Menu, X, ChevronDown, Eye, Users, Bell, BookOpen, Moon, Monitor, ShoppingBag } from 'lucide-react';

export default function AppShell({ children }) {
  const { user, token, logout } = useAuth();
  const { socket } = useSocket();
  const { settings, updateSetting } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [onlineCount, setOnlineCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [coinsBalance, setCoinsBalance] = useState(null);
  
  const notificationsRef = useOutsideClick(() => setNotificationsOpen(false));
  const userDropdownRef = useOutsideClick(() => setDropdownOpen(false));
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const [pendingChallenge, setPendingChallenge] = useState(null); // challenger waiting state
  const [notifications, setNotifications] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const challengeTimerRef = useRef(null);

  useEffect(() => {
    if (!user || !token) return;
    fetch(`http://localhost:3000/notifications/${user.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async r => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setNotifications(data);
        }
      })
      .catch(e => console.error('Failed to fetch notifications', e));
  }, [user, token]);

  // Fetch coin balance on mount
  useEffect(() => {
    if (!user || !token) return;
    fetch(`http://localhost:3000/users/daily-challenge?userId=${user.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.coinsBalance != null) setCoinsBalance(data.coinsBalance); })
      .catch(() => {});
  }, [user, token]);

  useEffect(() => {
    if (!socket || !user) return;
    
    // Note: user registration into the presence store now happens server-side
    // at socket handshake time (via the JWT auth middleware), so no manual
    // register_user emit is needed here.

    socket.on('online_count', (count) => {
      setOnlineCount(count);
    });

    // Live coin update from daily challenge
    socket.on('daily_challenge_updated', (data) => {
      if (data.coinsAwarded) {
        setCoinsBalance(prev => (prev ?? 0) + data.coinsAwarded);
      }
    });

    socket.on('friend_challenge_received', (data) => {
      if (settings.challengeAlerts) {
        // Clear any existing expiry timer
        if (challengeTimerRef.current) clearTimeout(challengeTimerRef.current);
        setIncomingChallenge(data);
        // Auto-expire after 60 seconds
        challengeTimerRef.current = setTimeout(() => {
          setIncomingChallenge(null);
          challengeTimerRef.current = null;
        }, 60000);
      }
    });

    socket.on('friend_challenge_declined', (data) => {
      setPendingChallenge(null);
      setToastMessage(data.byUsername ? `${data.byUsername} declined your challenge.` : 'Challenge declined.');
      setTimeout(() => setToastMessage(''), 4000);
    });

    socket.on('game_started', (data) => {
      setIncomingChallenge(null);
      setPendingChallenge(null);
      if (challengeTimerRef.current) {
        clearTimeout(challengeTimerRef.current);
        challengeTimerRef.current = null;
      }
      navigate(`/game/${data.gameId}`);
    });

    socket.on('notification_created', (notification) => {
      setNotifications(prev => [notification, ...prev]);
    });

    return () => {
      socket.off('online_count');
      socket.off('daily_challenge_updated');
      socket.off('friend_challenge_received');
      socket.off('friend_challenge_declined');
      socket.off('game_started');
      socket.off('notification_created');
    };
  }, [socket, user, navigate, settings.challengeAlerts]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleRespondChallenge = (accept) => {
    if (!incomingChallenge) return;
    // Clear the auto-expiry timer
    if (challengeTimerRef.current) {
      clearTimeout(challengeTimerRef.current);
      challengeTimerRef.current = null;
    }
    socket.emit('respond_friend_challenge', {
      fromUserId: incomingChallenge.fromUserId,
      toUserId: user.id,
      accept,
      timeControlSec: incomingChallenge.timeControlSec,
      incrementSec: incomingChallenge.incrementSec
    });
    setIncomingChallenge(null);
  };

  const handleNotificationClick = async (notification) => {
    setNotificationsOpen(false);
    
    // Mark as read
    if (!notification.read) {
      try {
        await fetch(`http://localhost:3000/notifications/${notification.id}/read`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
      } catch (e) {
        console.error('Failed to mark notification as read', e);
      }
    }

    // Navigate / restore challenge modal
    if (notification.type === 'FRIEND_REQUEST') {
      navigate('/friends');
    } else if (notification.type === 'CHALLENGE' || notification.type === 'GAME_INVITE') {
      // Reconstruct the challenge modal from the notification data
      // so the user can Accept/Decline even if they dismissed the original toast
      if (notification.data?.fromUserId) {
        if (challengeTimerRef.current) clearTimeout(challengeTimerRef.current);
        setIncomingChallenge({
          fromUserId: notification.data.fromUserId,
          fromUsername: notification.data.fromUsername,
          timeControlSec: notification.data.timeControlSec,
          incrementSec: notification.data.incrementSec,
        });
        challengeTimerRef.current = setTimeout(() => {
          setIncomingChallenge(null);
          challengeTimerRef.current = null;
        }, 60000);
      }

    } else if (notification.type === 'DRAW_OFFER') {
      if (notification.data?.gameId) {
        navigate(`/game/${notification.data.gameId}`);
      }
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const navItems = [
    { path: '/lobby',       label: 'Play',         icon: Play },
    { path: '/rules',       label: 'How to Play',  icon: BookOpen },
    { path: '/friends',     label: 'Friends',      icon: Users },
    { path: '/watch',       label: 'Watch',        icon: Eye },
    { path: '/leaderboard', label: 'Leaderboard',  icon: Trophy },
    { path: '/history',     label: 'Game History', icon: History },
    { path: '/shop',        label: 'Shop',         icon: ShoppingBag },
    { path: '/profile',     label: 'Profile',      icon: UserIcon },
    { path: '/settings',    label: 'Settings',     icon: Settings },
  ];

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'transparent', color: 'var(--text-primary)' }}>
      {/* Sidebar Navigation */}
      <aside 
        style={{ 
          width: '250px', 
          background: 'rgba(0,0,0,0.3)', 
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.3s ease',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 40,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(0)', // Adjust via CSS for mobile
        }}
        className={`sidebar ${sidebarOpen ? 'open' : ''}`}
      >
        <div style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--accent-color)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              CH
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', letterSpacing: '1px' }}>Chess</span>
          </Link>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)} style={{ marginLeft: 'auto', display: 'none', background: 'none', border: 'none', color: 'white' }}>
            <X size={24} />
          </button>
        </div>

        <nav style={{ padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          {navItems.map(item => {
            const isActive = location.pathname === item.path || (item.path === '/lobby' && location.pathname.startsWith('/game'));
            return (
              <Link
                key={item.label}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s'
                }}
                className="nav-link"
              >
                <item.icon size={20} color={isActive ? 'var(--accent-color)' : 'currentColor'} />
                <span style={{ fontWeight: isActive ? '600' : 'normal' }}>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Theme switcher footer — Light palette not built yet; both options stay dark */}
        <div style={{
          padding: '1rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Theme</div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {[
              { value: 'dark',   Icon: Moon,    label: 'Dark'   },
              { value: 'system', Icon: Monitor, label: 'System' },
            ].map(({ value, Icon, label }) => {
              const active = settings.theme === value;
              return (
                <button
                  key={value}
                  title={label}
                  onClick={() => updateSetting('theme', value)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                    padding: '0.45rem 0.3rem',
                    borderRadius: '6px',
                    border: active ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                    background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                    color: active ? 'var(--accent-color)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    fontWeight: active ? '700' : '400',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s'
                  }}
                  className="theme-btn"
                >
                  <Icon size={13} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, marginLeft: '250px', display: 'flex', flexDirection: 'column', minHeight: '100vh', width: 'calc(100% - 250px)' }} className="main-content-wrapper">
        
        {/* Top Bar */}
        <header style={{ 
          height: '70px', 
          borderBottom: '1px solid var(--border-color)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '0 2rem',
          background: 'rgba(0,0,0,0.2)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} style={{ display: 'none', background: 'none', border: 'none', color: 'white' }}>
              <Menu size={24} />
            </button>
          </div>

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>

              {/* Coin Balance Chip */}
              {coinsBalance !== null && (
                <div
                  onClick={() => navigate('/shop')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    background: 'linear-gradient(135deg, rgba(234,179,8,0.18), rgba(251,191,36,0.10))',
                    border: '1px solid rgba(234,179,8,0.35)',
                    borderRadius: '20px', padding: '0.35rem 0.85rem',
                    cursor: 'pointer', transition: 'all 0.2s',
                    userSelect: 'none',
                  }}
                  className="coin-chip"
                  title="Chess Coins — click to open Shop"
                >
                  <span style={{ fontSize: '1rem', lineHeight: 1 }}>🪙</span>
                  <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#fbbf24', letterSpacing: '0.3px' }}>
                    {coinsBalance.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Notification Bell */}
              <div style={{ position: 'relative' }} ref={notificationsRef}>
                <button 
                  onClick={() => { setNotificationsOpen(!notificationsOpen); setDropdownOpen(false); }}
                  style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', position: 'relative' }}
                  className="bell-btn"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span style={{ 
                      position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: 'white', 
                      fontSize: '0.65rem', fontWeight: 'bold', width: '16px', height: '16px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div style={{ 
                    position: 'absolute', top: '100%', right: '-50px', marginTop: '1rem', background: 'var(--surface-1)', 
                    border: '1px solid var(--border-color)', borderRadius: '8px', minWidth: '280px', maxWidth: '320px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)', animation: 'fadeIn 0.2s ease', zIndex: 100,
                    maxHeight: '400px', overflowY: 'auto'
                  }}>
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold' }}>Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={async () => {
                          try {
                            await fetch('http://localhost:3000/notifications/mark-all-read', { 
                              method: 'PATCH',
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                          } catch (e) {}
                        }} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.8rem' }}>
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        No notifications
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => handleNotificationClick(n)}
                            className="notification-item"
                            style={{ 
                              padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                              background: n.read ? 'transparent' : 'rgba(255,255,255,0.05)',
                              display: 'flex', flexDirection: 'column', gap: '0.25rem'
                            }}
                          >
                            <span style={{ fontSize: '0.9rem', fontWeight: n.read ? 'normal' : 'bold', color: n.read ? 'var(--text-secondary)' : 'white' }}>
                              {n.message}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ position: 'relative' }} ref={userDropdownRef}>
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'stretch', 
                    background: 'rgba(255,255,255,0.05)', 
                    border: '1px solid var(--border-color)',
                    borderRadius: '24px',
                    overflow: 'hidden'
                  }}
                >
                  <Link 
                    to="/profile"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.75rem', 
                      padding: '0.5rem 0.5rem 0.5rem 1rem',
                      textDecoration: 'none',
                      color: 'white',
                      transition: 'background 0.2s'
                    }}
                    className="user-dropdown-btn"
                  >
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 'bold', lineHeight: 1 }}>{user.username}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{user.rating || 1200}</span>
                    </div>
                  </Link>

                  <button 
                    onClick={() => { setDropdownOpen(!dropdownOpen); setNotificationsOpen(false); }}
                    style={{ 
                      background: 'transparent',
                      border: 'none',
                      borderLeft: '1px solid rgba(255,255,255,0.05)',
                      padding: '0.5rem 0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.2s'
                    }}
                    className="user-dropdown-btn"
                  >
                    <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                </div>

                {dropdownOpen && (
                  <div style={{ 
                    position: 'absolute', 
                    top: '100%', 
                    right: 0, 
                    marginTop: '0.5rem', 
                    background: 'var(--surface-1)', 
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    minWidth: '200px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    animation: 'fadeIn 0.2s ease'
                  }}>
                    <button onClick={handleLogout} style={{ 
                      width: '100%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.75rem', 
                      padding: '0.75rem 1rem',
                      background: 'none',
                      border: 'none',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      textAlign: 'left'
                    }} className="dropdown-item">
                      <LogOut size={16} />
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

        <main style={{ flex: 1, position: 'relative' }}>
          <Outlet />
        </main>
      </div>

      {/* Challenge incoming modal — position:fixed so it's above ALL stacking contexts */}
      {incomingChallenge && (
        <div style={{
          position: 'fixed',
          top: '5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--surface-1)',
          border: '2px solid var(--accent-color)',
          padding: '1.25rem 1.5rem',
          borderRadius: '12px',
          zIndex: 1000,
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          minWidth: '320px',
          animation: 'challengeSlideIn 0.3s ease'
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1rem' }}>⚔️ Challenge from {incomingChallenge.fromUsername}</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {incomingChallenge.timeControlSec / 60}+{incomingChallenge.incrementSec} • 5 minutes to accept
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button 
              onClick={() => handleRespondChallenge(true)}
              style={{ 
                background: 'var(--accent-color)', color: 'white', border: 'none', 
                padding: '0.6rem 1.25rem', borderRadius: '6px', cursor: 'pointer',
                fontWeight: 'bold', fontSize: '0.9rem'
              }}
            >
              ✓ Accept
            </button>
            <button 
              onClick={() => handleRespondChallenge(false)}
              style={{ 
                background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--border-color)', 
                padding: '0.6rem 1.25rem', borderRadius: '6px', cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              ✕ Decline
            </button>
          </div>
        </div>
      )}

      {/* General toast notification — position:fixed top-right */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '5rem',
          right: '2rem',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-color)',
          borderLeft: '4px solid var(--accent-color)',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
          zIndex: 1000,
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          animation: 'fadeIn 0.3s ease',
          maxWidth: '300px'
        }}>
          <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{toastMessage}</span>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%) !important;
          }
          .sidebar.open {
            transform: translateX(0) !important;
          }
          .main-content-wrapper {
            margin-left: 0 !important;
            width: 100% !important;
          }
          .mobile-menu-btn, .mobile-close {
            display: block !important;
          }
        }
        .nav-link:hover {
          background: rgba(255,255,255,0.05) !important;
        }
        .coin-chip:hover {
          background: linear-gradient(135deg, rgba(234,179,8,0.28), rgba(251,191,36,0.18)) !important;
          border-color: rgba(234,179,8,0.6) !important;
          transform: scale(1.03);
        }
        .user-dropdown-btn:hover {
          background: rgba(255,255,255,0.1) !important;
        }
        .dropdown-item:hover, .notification-item:hover {
          background: rgba(255,255,255,0.05) !important;
        }
        .theme-btn:hover {
          border-color: var(--accent-color) !important;
          color: var(--text-primary) !important;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes challengeSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.95); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
