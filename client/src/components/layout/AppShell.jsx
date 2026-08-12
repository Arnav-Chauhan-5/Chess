import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { Play, Trophy, History, User, Settings, LogOut, Menu, X, ChevronDown, Eye } from 'lucide-react';

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [onlineCount, setOnlineCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (!socket) return;
    
    socket.on('online_count', (count) => {
      setOnlineCount(count);
    });

    return () => {
      socket.off('online_count');
    };
  }, [socket]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { path: '/lobby', label: 'Play', icon: Play },
    { path: '/watch', label: 'Watch', icon: Eye },
    { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { path: '/history', label: 'Game History', icon: History },
    { path: '/profile', label: 'Profile', icon: User },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-primary)' }}>
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
          <div style={{ width: '32px', height: '32px', background: 'var(--accent-color)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            CH
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 'bold', letterSpacing: '1px' }}>Chess</span>
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
            <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
              {onlineCount} Players Online
            </div>
          </div>

          {user && (
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid var(--border-color)',
                  padding: '0.5rem 1rem',
                  borderRadius: '24px',
                  cursor: 'pointer',
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
                <ChevronDown size={16} style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }} />
              </button>

              {dropdownOpen && (
                <div style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  right: 0, 
                  marginTop: '0.5rem', 
                  background: 'var(--bg-color)', 
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
          )}
        </header>

        {/* Page Content */}
        <main style={{ flex: 1 }}>
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
        .dropdown-item:hover {
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
