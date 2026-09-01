import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { useSettings } from '../../context/SettingsContext';
import { Play, Trophy, History, User as UserIcon, Settings, LogOut, Menu, X, ChevronDown, Eye, Users, Bell, BookOpen, Monitor, ShoppingBag, Moon } from 'lucide-react';
import Logo from '../Logo';

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
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--on-surface)' }}>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        style={{
          width: '232px',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 40,
          transition: 'transform 0.25s ease',
        }}
        className={`sidebar ${sidebarOpen ? 'open' : ''}`}
      >
        {/* Logo area */}
        <div style={{
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          minHeight: '60px',
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit', flex: 1 }}>
            <Logo size="sm" />
          </Link>
          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
            style={{ display: 'none', background: 'none', border: 'none', color: 'var(--on-surface-variant)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav links */}
        <nav style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, overflowY: 'auto' }}>
          {navItems.map(item => {
            const isActive = location.pathname === item.path || (item.path === '/lobby' && location.pathname.startsWith('/game'));
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`nav-link ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '4px',
                  color: isActive ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                  background: isActive ? 'var(--primary)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: isActive ? '600' : '400',
                  transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
                  border: isActive ? '1px solid transparent' : '1px solid transparent',
                }}
              >
                <item.icon
                  size={17}
                  style={{ flexShrink: 0 }}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Theme switcher footer */}
        <div style={{
          padding: '12px',
          borderTop: '1px solid var(--border)',
        }}>
          {/* label-caps style inline since we can't use className on inner div easily */}
          <div style={{
            fontSize: '11px', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase',
            color: 'var(--on-surface-variant)', marginBottom: '8px',
          }}>Theme</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { value: 'dark', Icon: Moon, label: 'Dark' },
              /*
               * TODO: Re-enable "System" and "Light" options once a proper light-variant of
               * Onyx tokens is defined. For now, they are hidden to prevent a dead control.
               * { value: 'system', Icon: Monitor, label: 'System' },
               */
            ].map(({ value, Icon, label }) => {
              const active = settings.theme === value || (value === 'system' && (settings.theme === 'dark' || !settings.theme));
              return (
                <button
                  key={value}
                  title={label}
                  onClick={() => updateSetting('theme', value)}
                  className="theme-btn"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: active ? 'var(--primary)' : 'transparent',
                    color: active ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: active ? '600' : '400',
                    fontFamily: 'var(--font-sans)',
                    transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                  }}
                >
                  <Icon size={13} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div
        style={{ flex: 1, marginLeft: '232px', display: 'flex', flexDirection: 'column', minHeight: '100vh', width: 'calc(100% - 232px)' }}
        className="main-content-wrapper"
      >

        {/* Top Bar */}
        <header style={{
          height: '60px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: 'var(--surface)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
              style={{ display: 'none', background: 'none', border: 'none', color: 'var(--on-surface)', cursor: 'pointer', padding: '4px' }}
            >
              <Menu size={20} />
            </button>
          </div>

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

              {/* Coin Balance Chip */}
              {coinsBalance !== null && (
                <div
                  id="coin-chip"
                  onClick={() => navigate('/shop')}
                  className="coin-chip"
                  title="Chess Coins — click to open Shop"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    background: 'rgba(184,134,11,0.08)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    padding: '5px 10px',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ fontSize: '14px', lineHeight: 1 }}>🪙</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: '500',
                    fontSize: '13px',
                    color: 'var(--stats-gold)',
                    letterSpacing: '0.02em',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {coinsBalance.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Notification Bell */}
              <div style={{ position: 'relative' }} ref={notificationsRef}>
                <button
                  id="notifications-bell"
                  onClick={() => { setNotificationsOpen(!notificationsOpen); setDropdownOpen(false); }}
                  className="bell-btn"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--on-surface-variant)',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: '6px',
                    borderRadius: '4px',
                    transition: 'color 0.15s ease, background 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute', top: '2px', right: '2px',
                      background: 'var(--color-loss)', color: 'white',
                      fontSize: '10px', fontWeight: '700',
                      width: '15px', height: '15px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {notificationsOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: '-8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    minWidth: '280px', maxWidth: '320px',
                    boxShadow: 'var(--shadow-dropdown)',
                    animation: 'fadeIn 0.15s ease',
                    zIndex: 100,
                    maxHeight: '400px', overflowY: 'auto',
                  }}>
                    <div style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--on-surface)' }}>Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={async () => {
                            try {
                              await fetch('http://localhost:3000/notifications/mark-all-read', {
                                method: 'PATCH',
                                headers: { 'Authorization': `Bearer ${token}` }
                              });
                              setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                            } catch (e) {}
                          }}
                          style={{
                            background: 'none', border: 'none',
                            color: 'var(--primary)', cursor: 'pointer',
                            fontSize: '12px', fontWeight: '500',
                            fontFamily: 'var(--font-sans)',
                            transition: 'color 0.15s ease',
                          }}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{
                        padding: '24px 14px', textAlign: 'center',
                        color: 'var(--on-surface-variant)', fontSize: '13px',
                      }}>
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
                              padding: '10px 14px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border)',
                              background: n.read ? 'transparent' : 'rgba(59,76,122,0.05)',
                              display: 'flex', flexDirection: 'column', gap: '3px',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            <span style={{
                              fontSize: '13px',
                              fontWeight: n.read ? '400' : '600',
                              color: n.read ? 'var(--on-surface-variant)' : 'var(--on-surface)',
                            }}>
                              {n.message}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User chip + dropdown */}
              <div style={{ position: 'relative' }} ref={userDropdownRef}>
                <div style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  background: 'rgba(27,27,31,0.04)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}>
                  <Link
                    to="/profile"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px 6px 10px',
                      textDecoration: 'none',
                      color: 'var(--on-surface)',
                      transition: 'background 0.15s ease',
                    }}
                    className="user-profile-link"
                  >
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '50%',
                      background: 'var(--primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: '600', fontSize: '13px', color: 'var(--on-primary)',
                      flexShrink: 0,
                    }}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--on-surface)', lineHeight: 1 }}>
                        {user.username}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--on-surface-variant)',
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1,
                      }}>
                        {user.rating || 1200} ELO
                      </span>
                    </div>
                  </Link>

                  <button
                    onClick={() => { setDropdownOpen(!dropdownOpen); setNotificationsOpen(false); }}
                    className="user-chevron-btn"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderLeft: '1px solid var(--border)',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s ease',
                      color: 'var(--on-surface-variant)',
                    }}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                {/* User dropdown menu */}
                {dropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    padding: '4px',
                    minWidth: '180px',
                    boxShadow: 'var(--shadow-dropdown)',
                    animation: 'fadeIn 0.15s ease',
                    zIndex: 100,
                  }}>
                    <button
                      onClick={handleLogout}
                      className="dropdown-item"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-loss)',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        textAlign: 'left',
                        fontSize: '13px',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: '500',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <LogOut size={15} />
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

      {/* ── Challenge incoming modal ── position:fixed so it's above ALL stacking contexts */}
      {incomingChallenge && (
        <div style={{
          position: 'fixed',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--surface)',
          border: '2px solid var(--primary)',
          padding: '16px 20px',
          borderRadius: '4px',
          zIndex: 1000,
          boxShadow: 'var(--shadow-dropdown)',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          minWidth: '320px',
          animation: 'challengeSlideIn 0.25s ease',
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: 'var(--on-surface)' }}>
              ⚔️ Challenge from {incomingChallenge.fromUsername}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--on-surface-variant)' }}>
              {incomingChallenge.timeControlSec / 60}+{incomingChallenge.incrementSec} · 5 minutes to accept
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={() => handleRespondChallenge(true)}
              style={{
                background: 'var(--primary)', color: 'var(--on-primary)', border: 'none',
                padding: '7px 16px', borderRadius: '4px', cursor: 'pointer',
                fontWeight: '600', fontSize: '13px', fontFamily: 'var(--font-sans)',
                transition: 'background 0.15s ease',
              }}
              className="challenge-accept-btn"
            >
              ✓ Accept
            </button>
            <button
              onClick={() => handleRespondChallenge(false)}
              style={{
                background: 'transparent', color: 'var(--on-surface-variant)',
                border: '1px solid var(--border)',
                padding: '7px 16px', borderRadius: '4px', cursor: 'pointer',
                fontSize: '13px', fontFamily: 'var(--font-sans)',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
              className="challenge-decline-btn"
            >
              ✕ Decline
            </button>
          </div>
        </div>
      )}

      {/* ── General toast notification ── position:fixed top-right */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '72px',
          right: '16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderLeft: '3px solid var(--primary)',
          padding: '12px 16px',
          borderRadius: '4px',
          zIndex: 1000,
          boxShadow: 'var(--shadow-dropdown)',
          display: 'flex',
          alignItems: 'center',
          animation: 'fadeIn 0.2s ease',
          maxWidth: '300px',
        }}>
          <span style={{ fontWeight: '500', fontSize: '13px', color: 'var(--on-surface)' }}>{toastMessage}</span>
        </div>
      )}

      <style>{`
        /* Mobile breakpoints */
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
          .mobile-menu-btn,
          .mobile-close {
            display: flex !important;
          }
        }

        /* Nav link hover — Onyx inversion */
        .nav-link:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }
        .nav-link.active:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }

        /* Coin chip hover */
        .coin-chip:hover {
          background: #111111 !important;
        }

        /* Bell hover */
        .bell-btn:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }

        /* User profile link hover */
        .user-profile-link:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }

        /* Chevron button hover */
        .user-chevron-btn:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }

        /* Dropdown item hover */
        .dropdown-item:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }

        /* Notification item hover */
        .notification-item:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }

        /* Theme button hover */
        .theme-btn:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }

        /* Challenge modal button hovers */
        .challenge-accept-btn:hover {
          background: var(--on-primary) !important;
          color: var(--primary) !important;
          border: 1px solid var(--border) !important;
        }
        .challenge-decline-btn:hover {
          background: var(--primary) !important;
          color: var(--on-primary) !important;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes challengeSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-16px) scale(0.97); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
