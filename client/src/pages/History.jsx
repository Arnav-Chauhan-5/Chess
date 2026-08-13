import { useState, useEffect } from 'react';
import { History as HistoryIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { getTimeCategory } from '../utils/timeControl';

export default function History() {
  const { user } = useAuth();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      try {
        const res = await fetch(`http://localhost:3000/games/recent?userId=${user.id}&limit=20`);
        const data = await res.json();
        if (res.ok) setGames(data.games || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }} className="animate-fade-in">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', fontSize: '2rem' }}>
        <HistoryIcon size={32} color="var(--accent-color)" /> Game History
      </h2>
      
      <div className="glass-panel" style={{ padding: '2rem' }}>
        {loading ? (
          <p>Loading...</p>
        ) : games.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No games played yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem', fontWeight: 'normal' }}>Opponent</th>
                <th style={{ padding: '1rem', fontWeight: 'normal' }}>Result</th>
                <th style={{ padding: '1rem', fontWeight: 'normal' }}>Time Control</th>
                <th style={{ padding: '1rem', fontWeight: 'normal' }}>Date</th>
                <th style={{ padding: '1rem', fontWeight: 'normal' }}></th>
              </tr>
            </thead>
            <tbody>
              {games.map(game => {
                const isWhite = game.whiteId === user?.id;
                const opponent = isWhite ? (game.blackPlayer?.username || 'AI') : (game.whitePlayer?.username || 'AI');
                
                let resultClass = 'text-secondary';
                let resultText = 'Draw';
                if (game.status === 'WHITE_WON') {
                  resultClass = isWhite ? 'text-success' : 'text-danger';
                  resultText = isWhite ? 'Won' : 'Lost';
                } else if (game.status === 'BLACK_WON') {
                  resultClass = !isWhite ? 'text-success' : 'text-danger';
                  resultText = !isWhite ? 'Won' : 'Lost';
                }

                return (
                  <tr key={game.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>vs {opponent}</td>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>
                      <span style={{ color: resultClass === 'text-success' ? '#10b981' : resultClass === 'text-danger' ? '#ef4444' : 'var(--text-secondary)' }}>
                        {resultText}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{game.timeControlSec/60}+{game.incrementSec}</span>
                        <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                          {getTimeCategory(game.timeControlSec/60)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{new Date(game.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <Link to={`/game/${game.id}`} className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Review</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
