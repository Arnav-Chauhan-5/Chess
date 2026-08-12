import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DecorativeBoard from '../components/DecorativeBoard';
import { Zap, Bot, Users, Trophy, Play, ArrowRight } from 'lucide-react';

const FEATURES = [
  {
    icon: Zap,
    title: 'Quick Pairing',
    desc: 'Jump into a rated match in seconds. Choose from Bullet, Blitz, Rapid, or Classical time controls.'
  },
  {
    icon: Bot,
    title: 'Play vs AI',
    desc: 'Challenge bots from Beginner to Grandmaster strength. Perfect for practice or warming up.'
  },
  {
    icon: Users,
    title: 'Play a Friend',
    desc: 'Create a private room, share the code, and play a casual game with anyone you choose.'
  },
  {
    icon: Trophy,
    title: 'Leaderboard',
    desc: 'Climb the rankings with an Elo-based rating system. See how you stack up against every other player.'
  }
];

export default function Home() {
  const { user } = useAuth();

  // Logged-in users go straight to the lobby
  if (user) {
    return <Navigate to="/lobby" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-primary)', overflow: 'hidden' }}>

      {/* Minimal top bar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.5rem 3rem',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'var(--accent-color)',
            borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', fontSize: '0.9rem'
          }}>CH</div>
          <span style={{ fontSize: '1.4rem', fontWeight: '700', letterSpacing: '1px' }}>Chess</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/login" style={{
            padding: '0.6rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'transparent',
            color: 'var(--text-primary)',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '0.95rem',
            transition: 'all 0.2s'
          }}>Sign In</Link>
          <Link to="/register" className="btn" style={{
            padding: '0.6rem 1.5rem',
            fontSize: '0.95rem'
          }}>Create Account</Link>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5rem',
        padding: '4rem 3rem 6rem',
        maxWidth: '1300px',
        margin: '0 auto',
        flexWrap: 'wrap'
      }}>
        {/* Left: Demo Board */}
        <div className="animate-fade-in" style={{ flex: '0 0 auto' }}>
          <DecorativeBoard />
        </div>

        {/* Right: Copy + CTAs */}
        <div className="animate-fade-in" style={{
          flex: '1 1 400px',
          maxWidth: '520px',
          animationDelay: '0.15s'
        }}>
          <h1 style={{
            fontSize: 'clamp(2.5rem, 5vw, 3.75rem)',
            fontWeight: '700',
            lineHeight: 1.1,
            marginBottom: '1.5rem',
            background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 70%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Play Chess Online, Your Way
          </h1>
          <p style={{
            fontSize: '1.2rem',
            lineHeight: 1.7,
            color: 'var(--text-secondary)',
            marginBottom: '2.5rem'
          }}>
            Match up with players around the world in real time, challenge AI opponents 
            at any skill level, or invite a friend for a private game. Beautiful interface, 
            instant pairing, and an Elo rating that tracks your progress.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn" style={{
              padding: '1rem 2.25rem',
              fontSize: '1.15rem',
              boxShadow: '0 4px 20px rgba(59, 130, 246, 0.35)'
            }}>
              <Play size={22} /> Start Playing Free
            </Link>
            <Link to="/login" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '1rem 2rem',
              fontSize: '1.1rem',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontWeight: '600',
              borderRadius: '8px',
              transition: 'color 0.2s'
            }}>
              Already have an account? <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem 3rem 6rem'
      }}>
        <h2 style={{
          textAlign: 'center',
          fontSize: '2rem',
          fontWeight: '700',
          marginBottom: '3rem',
          color: 'var(--text-primary)'
        }}>
          Everything You Need to Play
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem'
        }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="glass-panel animate-fade-in"
              style={{
                padding: '2rem',
                animationDelay: `${0.1 * i}s`,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                transition: 'transform 0.25s, box-shadow 0.25s',
                cursor: 'default'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(59, 130, 246, 0.15)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.3)';
              }}
            >
              <div style={{
                width: '48px', height: '48px',
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <f.icon size={24} color="var(--accent-color)" />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '600' }}>{f.title}</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Background decoration */}
      <div style={{
        position: 'fixed',
        top: '-50%', right: '-20%',
        width: '800px', height: '800px',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'fixed',
        bottom: '-30%', left: '-15%',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
    </div>
  );
}
