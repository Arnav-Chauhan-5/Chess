import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Play } from 'lucide-react';

export default function Home() {
  const { user } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center' }}>
      <h1 style={{ fontSize: '4rem', fontWeight: 'bold', marginBottom: '1rem', background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Chess
      </h1>
      <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '600px', marginBottom: '3rem' }}>
        A premium real-time multiplayer chess experience. Play against friends, match up with players globally, or challenge our powerful AI.
      </p>

      {user ? (
        <div className="animate-fade-in">
          <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Welcome back, <strong style={{ color: 'var(--accent-color)' }}>{user.username}</strong>!</p>
          <Link to="/lobby" className="btn" style={{ fontSize: '1.25rem', padding: '1rem 2rem' }}>
            <Play size={24} /> Enter Lobby
          </Link>
        </div>
      ) : (
        <div className="animate-fade-in" style={{ display: 'flex', gap: '1rem' }}>
          <Link to="/login" className="btn" style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}>
            Sign In
          </Link>
          <Link to="/register" className="btn" style={{ fontSize: '1.1rem', padding: '0.75rem 2rem', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}>
            Create Account
          </Link>
        </div>
      )}
    </div>
  );
}
