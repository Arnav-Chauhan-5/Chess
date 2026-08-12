import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { Eye, Clock } from 'lucide-react';

export default function Watch() {
  const { socket } = useSocket();
  const [liveGames, setLiveGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!socket) return;

    socket.emit('get_live_games');

    socket.on('live_games_updated', (games) => {
      setLiveGames(games);
      setLoading(false);
    });

    return () => {
      socket.off('live_games_updated');
    };
  }, [socket]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }} className="animate-fade-in">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', fontSize: '2rem' }}>
        <Eye size={32} color="var(--accent-color)" /> Live Spectating
      </h2>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem', fontWeight: 'normal' }}>White</th>
                <th style={{ padding: '1rem', fontWeight: 'normal' }}>Black</th>
                <th style={{ padding: '1rem', fontWeight: 'normal' }}>Time Control</th>
                <th style={{ padding: '1rem', fontWeight: 'normal' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading live games...
                  </td>
                </tr>
              ) : liveGames.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No live games right now.
                  </td>
                </tr>
              ) : (
                liveGames.map((game) => (
                  <tr key={game.gameId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} className="hover-bg-subtle">
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>
                      {game.whiteUsername} <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'normal' }}>({game.whiteRating})</span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>
                      {game.blackUsername} <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'normal' }}>({game.blackRating})</span>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Clock size={14} />
                        {game.timeControlSec / 60}+{game.incrementSec}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <Link 
                        to={`/game/${game.gameId}`}
                        className="btn"
                        style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        Watch <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <style>{`
        .hover-bg-subtle:hover {
          background: rgba(255,255,255,0.03) !important;
        }
      `}</style>
    </div>
  );
}
