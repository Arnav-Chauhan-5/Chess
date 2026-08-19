import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { Users, UserPlus, Check, X, Swords } from 'lucide-react';

export default function Friends() {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [challengeStatus, setChallengeStatus] = useState({ type: '', message: '' });

  const fetchFriends = async () => {
    try {
      const res = await fetch(`http://localhost:3000/friends/${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.accepted);
        setIncoming(data.pendingIncoming);
        setOutgoing(data.pendingOutgoing);
      }
    } catch (e) {
      console.error('Failed to fetch friends', e);
    }
  };

  useEffect(() => {
    fetchFriends();

    if (!socket) return;

    const onStatusChanged = ({ userId, isOnline }) => {
      setFriends(prev => prev.map(f => f.id === userId ? { ...f, isOnline } : f));
    };

    socket.on('friend_status_changed', onStatusChanged);

    return () => {
      socket.off('friend_status_changed', onStatusChanged);
    };
  }, [user, socket]);

  const sendRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await fetch('http://localhost:3000/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ toUsername: searchUsername })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setSuccess('Friend request sent!');
      setSearchUsername('');
      fetchFriends();
    } catch (e) {
      setError(e.message);
    }
  };

  const respondToRequest = async (friendshipId, accept) => {
    try {
      const res = await fetch('http://localhost:3000/friends/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ friendshipId, accept })
      });
      if (res.ok) fetchFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const handleChallenge = (friend) => {
    if (!friend.isOnline) {
      setChallengeStatus({ type: 'error', message: `${friend.username} is offline.` });
      setTimeout(() => setChallengeStatus({ type: '', message: '' }), 3000);
      return;
    }
    
    // Quick challenge 5+0 for simplicity, or we can prompt for time control
    const timeControlSec = 300;
    const incrementSec = 0;
    
    socket.emit('challenge_friend', {
      fromUserId: user.id,
      fromUsername: user.username,
      toUserId: friend.id,
      timeControlSec,
      incrementSec
    });
    setChallengeStatus({ type: 'success', message: `Challenge sent to ${friend.username}!` });
    setTimeout(() => setChallengeStatus({ type: '', message: '' }), 3000);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <Users size={32} color="var(--accent-color)" /> Friends
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Left Column: Friends List */}
        <div className="glass-panel">
          <h2 style={{ marginTop: 0, fontSize: '1.25rem', marginBottom: '1rem' }}>My Friends</h2>
          
          {challengeStatus.message && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '4px', textAlign: 'center', background: challengeStatus.type === 'error' ? 'var(--danger)' : '#10b981', color: 'white', fontSize: '0.9rem' }}>
              {challengeStatus.message}
            </div>
          )}

          {friends.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>You haven't added any friends yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {friends.map(f => (
                <div key={f.id} className="surface-2" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ width: '40px', height: '40px', background: 'var(--accent-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {f.username.charAt(0).toUpperCase()}
                      </div>
                      <div style={{
                        position: 'absolute', bottom: 0, right: 0,
                        width: '12px', height: '12px', borderRadius: '50%',
                        background: f.isOnline ? '#10b981' : '#6b7280',
                        border: '2px solid var(--bg-color)'
                      }}></div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{f.username}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rating: {f.rating}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleChallenge(f)}
                    disabled={!f.isOnline}
                    className="btn"
                    style={{
                      opacity: f.isOnline ? 1 : 0.5,
                      height: 'auto',
                      padding: '0.5rem 1rem'
                    }}
                  >
                    <Swords size={16} /> Challenge
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Requests & Search */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div className="glass-panel">
            <h2 style={{ marginTop: 0, fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserPlus size={20} /> Add Friend
            </h2>
            <form onSubmit={sendRequest} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Username..."
                value={searchUsername}
                onChange={e => setSearchUsername(e.target.value)}
                className="surface-2"
                style={{
                  flex: 1, padding: '0.75rem', color: 'white', outline: 'none'
                }}
              />
              <button type="submit" className="btn" style={{ padding: '0 1.5rem' }}>
                Send
              </button>
            </form>
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginTop: '0.5rem' }}>{error}</p>}
            {success && <p style={{ color: '#10b981', fontSize: '0.9rem', marginTop: '0.5rem' }}>{success}</p>}
          </div>

          {(incoming.length > 0 || outgoing.length > 0) && (
            <div className="glass-panel">
              {incoming.length > 0 && (
                <div style={{ marginBottom: outgoing.length > 0 ? '1.5rem' : '0' }}>
                  <h3 style={{ marginTop: 0, fontSize: '1rem', marginBottom: '1rem' }}>Incoming Requests</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {incoming.map(req => (
                      <div key={req.friendshipId} className="surface-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem' }}>
                        <span>{req.username}</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => respondToRequest(req.friendshipId, true)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.4rem', borderRadius: '4px', cursor: 'pointer' }}><Check size={16}/></button>
                          <button onClick={() => respondToRequest(req.friendshipId, false)} style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '0.4rem', borderRadius: '4px', cursor: 'pointer' }}><X size={16}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {outgoing.length > 0 && (
                <div>
                  <h3 style={{ marginTop: 0, fontSize: '1rem', marginBottom: '1rem' }}>Outgoing Requests</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {outgoing.map(req => (
                      <div key={req.friendshipId} className="surface-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{req.username}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pending</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
