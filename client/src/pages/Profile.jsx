import { useState, useEffect } from 'react';
import { User, Edit2, Link as LinkIcon, Trash2, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { getTimeCategory } from '../utils/timeControl';

export default function Profile() {
  const { user, login } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editError, setEditError] = useState('');
  const [unlinkError, setUnlinkError] = useState('');

  const fetchProfile = async () => {
    try {
      const res = await fetch(`http://localhost:3000/users/profile?userId=${user.id}`);
      const data = await res.json();
      if (res.ok) {
        setProfileData(data);
        setEditUsername(data.user.username);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    setEditError('');
    try {
      const res = await fetch('http://localhost:3000/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, username: editUsername })
      });
      const data = await res.json();
      if (res.ok) {
        setIsEditing(false);
        setProfileData({ ...profileData, user: { ...profileData.user, username: editUsername } });
        // Also update the global auth context context
        login(data.user.id, data.user.username, data.user.rating); 
      } else {
        setEditError(data.error || 'Failed to update');
      }
    } catch (err) {
      setEditError('Network error');
    }
  };

  const handleUnlink = async (provider) => {
    setUnlinkError('');
    try {
      const res = await fetch(`http://localhost:3000/users/oauth/${provider}?userId=${user.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        fetchProfile(); // Refresh to get updated accounts list
      } else {
        setUnlinkError(data.error || 'Failed to unlink account');
      }
    } catch (err) {
      setUnlinkError('Network error while unlinking');
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading profile...</div>;
  }

  if (!profileData) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Could not load profile.</div>;
  }

  const { user: profileUser, stats, recentGames } = profileData;

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }} className="animate-fade-in">
      
      {/* Profile Header */}
      <div className="glass-panel" style={{ padding: '2.5rem', display: 'flex', gap: '2rem', alignItems: 'center', position: 'relative' }}>
        <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-color), #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem', fontWeight: 'bold', color: 'white' }}>
          {profileUser.username.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          {isEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <input 
                type="text" 
                value={editUsername} 
                onChange={(e) => setEditUsername(e.target.value)}
                className="surface-2"
                style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white', padding: '0.5rem', width: '300px', outline: 'none' }}
              />
              <button onClick={handleSaveProfile} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Check size={24} />
              </button>
              <button onClick={() => { setIsEditing(false); setEditUsername(profileUser.username); }} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={24} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '2.5rem', margin: 0 }}>{profileUser.username}</h2>
              <button onClick={() => setIsEditing(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}>
                <Edit2 size={20} className="hover-accent" />
              </button>
            </div>
          )}
          {editError && <div style={{ color: '#ef4444', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{editError}</div>}
          
          <div style={{ display: 'flex', gap: '2rem', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
            <span>Rating: <strong style={{ color: 'var(--text-primary)' }}>{profileUser.rating}</strong></span>
            <span>Joined: <strong style={{ color: 'var(--text-primary)' }}>{new Date(profileUser.createdAt).toLocaleDateString()}</strong></span>
          </div>
        </div>
      </div>

      {/* Grid Layout for Stats & Accounts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Statistics */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.25rem' }}>
            Statistics
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div className="surface-2" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{stats.total}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Games Played</div>
            </div>
            <div className="surface-2" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981' }}>{stats.wins}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Wins</div>
            </div>
            <div className="surface-2" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ef4444' }}>{stats.losses}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Losses</div>
            </div>
            <div className="surface-2" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{stats.draws}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Draws</div>
            </div>
          </div>
        </div>

        {/* Linked Accounts */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.25rem' }}>
            <LinkIcon size={20} color="var(--accent-color)" /> Linked Accounts
          </h3>
          
          {unlinkError && <div style={{ color: '#ef4444', fontSize: '0.9rem', marginBottom: '1rem' }}>{unlinkError}</div>}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {profileUser.oauthAccounts?.length > 0 ? (
              profileUser.oauthAccounts.map(account => {
                const canUnlink = profileUser.hasPassword || profileUser.oauthAccounts.length > 1;
                return (
                  <div key={account.provider} className="surface-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></div>
                      <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{account.provider}</span>
                    </div>
                    <button 
                      onClick={() => handleUnlink(account.provider)}
                      disabled={!canUnlink}
                      style={{ 
                        background: 'transparent', 
                        color: canUnlink ? '#ef4444' : 'var(--text-secondary)', 
                        border: '1px solid ' + (canUnlink ? '#ef4444' : 'var(--text-secondary)'), 
                        padding: '0.5rem 1rem', 
                        borderRadius: '4px', 
                        cursor: canUnlink ? 'pointer' : 'not-allowed',
                        opacity: canUnlink ? 1 : 0.5
                      }}
                      title={!canUnlink ? "Cannot unlink your only login method" : "Unlink account"}
                    >
                      Unlink
                    </button>
                  </div>
                )
              })
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>No OAuth accounts linked.</p>
            )}
            
            {profileUser.hasPassword && (
              <div className="surface-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></div>
                  <span style={{ fontWeight: 'bold' }}>Password Authentication</span>
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Primary</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Games embedded view */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Recent Games</h3>
        
        {recentGames?.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No recent games to display.</p>
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
              {recentGames.map(game => {
                const isWhite = game.whiteId === user?.id;
                
                let myRating = isWhite ? game.whiteRatingAtGame : game.blackRatingAtGame;
                myRating = myRating || (isWhite ? game.whitePlayer?.rating : game.blackPlayer?.rating) || user?.rating;

                let oppName = isWhite ? game.blackPlayer?.username : game.whitePlayer?.username;
                if (game.vsAI) oppName = game.aiPersonaName || "AI";
                else if (!oppName) oppName = "Unknown";
                
                let oppRating = isWhite ? game.blackRatingAtGame : game.whiteRatingAtGame;
                oppRating = oppRating || (isWhite ? game.blackPlayer?.rating : game.whitePlayer?.rating);
                
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
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>You ({myRating}) vs </span> 
                      {oppRating ? `${oppName} (${oppRating})` : oppName}
                    </td>
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

      <style>{`
        .hover-accent:hover {
          color: var(--accent-color);
          transition: color 0.2s;
        }
      `}</style>
    </div>
  );
}
