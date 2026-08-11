import { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const res = await fetch(`http://localhost:3000/users/profile?userId=${user.id}`);
        const data = await res.json();
        if (res.ok) setProfileData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }} className="animate-fade-in">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', fontSize: '2rem' }}>
        <User size={32} color="var(--accent-color)" /> Player Profile
      </h2>
      
      <div className="glass-panel" style={{ padding: '2rem' }}>
        {loading ? (
          <p>Loading...</p>
        ) : !profileData ? (
          <p style={{ color: 'var(--text-secondary)' }}>Could not load profile data.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', fontWeight: 'bold' }}>
                {profileData.user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{profileData.user.username}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem' }}>Rating: {profileData.user.rating}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Joined: {new Date(profileData.user.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>

            <div>
              <h4 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Statistics</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{profileData.stats.total}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Games Played</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>{profileData.stats.wins}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Wins</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>{profileData.stats.losses}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Losses</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{profileData.stats.draws}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Draws</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
