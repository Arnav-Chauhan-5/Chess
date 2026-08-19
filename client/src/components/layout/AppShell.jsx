import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { useSettings } from '../../context/SettingsContext';
import { Play, Trophy, History, User as UserIcon, Settings, LogOut, Menu, X, ChevronDown, Eye, Users, Bell, BookOpen } from 'lucide-react';

export default function AppShell({ children }) {
  const { user, token, logout } = useAuth();
  const { socket } = useSocket();
  const { settings } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [onlineCount, setOnlineCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [toastMessage, setToastMessage] = useState('');

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

  useEffect(() => {
    if (!socket || !user) return;
    
    // Register user for online status and direct events
    socket.emit('register_user', { userId: user.id });

    socket.on('online_count', (count) => {
      setOnlineCount(count);
    });

    socket.on('friend_challenge_received', (data) => {
      // Gate the toast behind the setting.
      // Even if false, the state is synced elsewhere, just no toast here.
      if (settings.challengeAlerts) {
        setIncomingChallenge(data);
      }
    });

    socket.on('friend_challenge_declined', (data) => {
      setToastMessage('Challenge declined.');
      setTimeout(() => setToastMessage(''), 3000);
    });

    socket.on('game_started', (data) => {
      // If we are anywhere and a game starts (like from a challenge), navigate
      // Only navigate if it's our game (we just accepted or got accepted)
      setIncomingChallenge(null);
      navigate(`/game/${data.gameId}`);
    });

    socket.on('notification_created', (notification) => {
      setNotifications(prev => [notification, ...prev]);
    });

    return () => {
      socket.off('online_count');
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

    // Navigate
    if (notification.type === 'FRIEND_REQUEST') {
      navigate('/friends');
    } else if (notification.type === 'CHALLENGE' || notification.type === 'GAME_INVITE') {
      // For a challenge, we might just navigate to friends where they can accept it
      navigate('/friends');
    } else if (notification.type === 'DRAW_OFFER') {
      if (notification.data?.gameId) {
        navigate(`/game/${notification.data.gameId}`);
      }
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const navItems = [
    { path: '/lobby', label: 'Play', icon: Play },
    { path: '/rules', label: 'How to Play', icon: BookOpen },
    { path: '/friends', label: 'Friends', icon: Users },
    { path: '/watch', label: 'Watch', icon: Eye },
    { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { path: '/history', label: 'Game History', icon: History },
    { path: '/profile', label: 'Profile', icon: UserIcon },
    { path: '/settings', label: 'Settings', icon: Settings },
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
              
              {/* Notification Bell */}
              <div style={{ position: 'relative' }}>
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

              <div style={{ position: 'relative' }}>
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

        {/* Page Content */}
        <main style={{ flex: 1, position: 'relative' }}>
          {incomingChallenge && (
            <div style={{
              position: 'absolute',
              top: '1rem',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--surface-1)',
              border: '1px solid var(--accent-color)',
              padding: '1rem',
              borderRadius: '8px',
              zIndex: 50,
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: 'bold' }}>Challenge from {incomingChallenge.fromUsername}</p>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {incomingChallenge.timeControlSec / 60}+{incomingChallenge.incrementSec}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => handleRespondChallenge(true)}
                  style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Accept
                </button>
                <button 
                  onClick={() => handleRespondChallenge(false)}
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Decline
                </button>
              </div>
            </div>
          )}
          {toastMessage && (
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '2rem',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-color)',
              borderLeft: '4px solid var(--accent-color)',
              padding: '1rem',
              borderRadius: '8px',
              zIndex: 50,
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              animation: 'fadeIn 0.3s ease'
            }}>
              <span style={{ fontWeight: 'bold' }}>{toastMessage}</span>
            </div>
          )}
          <Outlet />
        </main>
      </div>

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
        .user-dropdown-btn:hover {
          background: rgba(255,255,255,0.1) !important;
        }
        .dropdown-item:hover, .notification-item:hover {
          background: rgba(255,255,255,0.05) !important;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
