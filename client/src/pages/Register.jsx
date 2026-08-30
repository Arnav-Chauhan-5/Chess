import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Crown } from 'lucide-react';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await register(username, email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to register');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', overflow: 'hidden' }}>
      
      {/* Subtle Background Element */}
      <div style={{ position: 'absolute', opacity: 0.02, pointerEvents: 'none', transform: 'rotate(-15deg)', left: '50%', marginLeft: '-250px', top: '50%', marginTop: '-250px' }}>
        <Crown size={500} />
      </div>

      <div className="glass-panel animate-fade-in" style={{ 
        width: '100%', 
        maxWidth: '440px', 
        padding: '2.5rem 2.5rem', 
        position: 'relative', 
        zIndex: 1, 
        boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08), 0 0 40px rgba(59, 130, 246, 0.15)',
        borderRadius: '16px'
      }}>
        
        {/* App Branding */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ width: '40px', height: '40px', background: 'var(--accent-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: 'white', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)' }}>
            CH
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '1px' }}>Chess</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Create Account</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Join the community and start playing</p>
        </div>

        {error && (
          <div style={{ background: 'var(--danger)', color: '#fff', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="surface-2"
              style={{
                width: '100%', padding: '0.75rem',
                color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
                borderRadius: '8px', border: '1px solid transparent',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'}
              onBlur={(e) => e.target.style.borderColor = 'transparent'}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="surface-2"
              style={{
                width: '100%', padding: '0.75rem',
                color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
                borderRadius: '8px', border: '1px solid transparent',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'}
              onBlur={(e) => e.target.style.borderColor = 'transparent'}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="surface-2"
              style={{
                width: '100%', padding: '0.75rem',
                color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
                borderRadius: '8px', border: '1px solid transparent',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'}
              onBlur={(e) => e.target.style.borderColor = 'transparent'}
            />
          </div>
          <button type="submit" className="btn" disabled={isLoading} style={{ marginTop: '0.5rem', width: '100%', padding: '0.875rem', borderRadius: '8px', fontWeight: 'bold' }}>
            <UserPlus size={18} />
            {isLoading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: '600' }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
