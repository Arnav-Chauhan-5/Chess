import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';

export default function Leaderboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch('http://localhost:3000/users/leaderboard?limit=50');
        const data = await res.json();
        if (res.ok) setUsers(data.users || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }} className="animate-fade-in">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', fontSize: '2rem' }}>
        <Trophy size={32} color="var(--accent-color)" /> Global Leaderboard
      </h2>
      
      <div className="glass-panel" style={{ padding: '2rem' }}>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem', fontWeight: 'normal' }}>Rank</th>
                <th style={{ padding: '1rem', fontWeight: 'normal' }}>Player</th>
                <th style={{ padding: '1rem', fontWeight: 'normal', textAlign: 'right' }}>Rating</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem', fontWeight: 'bold', color: i < 3 ? 'var(--accent-color)' : 'inherit' }}>
                    #{i + 1}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 'bold' }}>{u.username}</td>
                  <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{u.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
