import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { Users, UserPlus, Check, X, Swords, Clock } from 'lucide-react';
import { API_URL } from '../config';

export default function Friends() {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [challengeStatus, setChallengeStatus] = useState({ type: '', message: '' });
  const [pendingChallengeToId, setPendingChallengeToId] = useState(null); // id of friend we challenged

  const fetchFriends = async () => {
    if (!user?.id || !token) return;
    try {
      const res = await fetch(`${API_URL}/friends/${user.id}`, {
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

    // Re-fetch once our socket confirms it's connected and registered server-side.
    // This ensures the online flags reflect the presence store, which is populated
    // only after the socket handshake auth middleware runs.
    const onConnect = () => {
      fetchFriends();
    };

    // Live status updates pushed by the server when a friend connects/disconnects
    const onStatusChanged = ({ userId, isOnline }) => {
      setFriends(prev => prev.map(f => f.id === userId ? { ...f, isOnline } : f));
    };

    if (socket.connected) {
      // Already connected when this effect runs — fetch immediately
      fetchFriends();
    }

    socket.on('connect', onConnect);
    socket.on('friend_status_changed', onStatusChanged);

    // Server error (e.g. duplicate challenge, friend offline)
    const onSocketError = ({ message }) => {
      setChallengeStatus({ type: 'error', message });
      setPendingChallengeToId(null);
      setTimeout(() => setChallengeStatus({ type: '', message: '' }), 4000);
    };
    socket.on('error', onSocketError);

    // When the game starts (accepted challenge), navigate into the room
    const onGameStarted = ({ gameId }) => {
      setPendingChallengeToId(null);
      navigate(`/game/${gameId}`);
    };
    socket.on('game_started', onGameStarted);

    // Challenger is notified when declined
    const onDeclined = ({ byUsername }) => {
      setPendingChallengeToId(null);
      setChallengeStatus({ type: 'error', message: `${byUsername || 'Friend'} declined your challenge.` });
      setTimeout(() => setChallengeStatus({ type: '', message: '' }), 4000);
    };
    socket.on('friend_challenge_declined', onDeclined);

    return () => {
      socket.off('connect', onConnect);
      socket.off('friend_status_changed', onStatusChanged);
      socket.off('error', onSocketError);
      socket.off('game_started', onGameStarted);
      socket.off('friend_challenge_declined', onDeclined);
    };
  }, [user, token, socket]);

  const sendRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (searchUsername.trim().toLowerCase() === user.username.toLowerCase()) {
      setError("You cannot friend yourself");
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/friends/request`, {
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
      const res = await fetch(`${API_URL}/friends/respond`, {
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
    if (pendingChallengeToId) {
      setChallengeStatus({ type: 'error', message: 'You already have a pending challenge.' });
      setTimeout(() => setChallengeStatus({ type: '', message: '' }), 3000);
      return;
    }
    
    const timeControlSec = 300;
    const incrementSec = 0;
    
    socket.emit('challenge_friend', {
      fromUserId: user.id,
      fromUsername: user.username,
      toUserId: friend.id,
      timeControlSec,
      incrementSec
    });
    setPendingChallengeToId(friend.id);
    setChallengeStatus({ type: 'success', message: `Challenge sent to ${friend.username}! Waiting for response...` });
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
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Rating: {f.rating} • <span style={{ color: f.isOnline ? '#10b981' : '#6b7280' }}>{f.isOnline ? 'Online' : 'Offline'}</span>
                      </div>
                    </div>
                  </div>
                  {(() => {
                    const isPending = pendingChallengeToId === f.id;
                    const isDisabled = !f.isOnline || isPending || (pendingChallengeToId && pendingChallengeToId !== f.id);
                    return (
                      <button 
                        onClick={() => handleChallenge(f)}
                        disabled={isDisabled}
                        className="btn"
                        style={{
                          opacity: isDisabled ? 0.5 : 1,
                          height: 'auto',
                          padding: '0.5rem 1rem',
                          minWidth: '120px'
                        }}
                      >
                        {isPending
                          ? <><Clock size={16} /> Waiting...</>
                          : <><Swords size={16} /> Challenge</>
                        }
                      </button>
                    );
                  })()}
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
