import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Link as LinkIcon, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Link } from 'react-router-dom';

export default function Settings() {
  const { user } = useAuth();
  const { settings, updateSetting } = useSettings();
  
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });
  const [privacyMsg, setPrivacyMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const res = await fetch(`http://localhost:3000/users/profile?userId=${user.id}`);
        const data = await res.json();
        if (res.ok) {
          setShowOnlineStatus(data.user.showOnlineStatus ?? true);
          setHasPassword(data.user.hasPassword);
        }
      } catch (e) {
        console.error('Failed to load settings from server', e);
      }
    };
    fetchProfile();
  }, [user]);

  const handleToggleOnlineStatus = async (e) => {
    const val = e.target.checked;
    setShowOnlineStatus(val);
    setPrivacyMsg('');
    try {
      const res = await fetch('http://localhost:3000/users/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, showOnlineStatus: val })
      });
      if (res.ok) {
        setPrivacyMsg('Privacy settings saved.');
        setTimeout(() => setPrivacyMsg(''), 3000);
      } else {
        setPrivacyMsg('Failed to save privacy settings.');
      }
    } catch (e) {
      setPrivacyMsg('Network error.');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });
    
    if (!passwords.currentPassword || !passwords.newPassword) {
      setPasswordMsg({ type: 'error', text: 'Please fill in both fields.' });
      return;
    }
    
    try {
      const res = await fetch('http://localhost:3000/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setPasswordMsg({ type: 'success', text: 'Password updated successfully!' });
        setPasswords({ currentPassword: '', newPassword: '' });
      } else {
        setPasswordMsg({ type: 'error', text: data.error || 'Failed to update password.' });
      }
    } catch (err) {
      setPasswordMsg({ type: 'error', text: 'Network error.' });
    }
  };

  const ToggleRow = ({ id, label, checked, onChange, description }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div>
        <label htmlFor={id} style={{ fontWeight: 'bold', display: 'block', cursor: 'pointer' }}>{label}</label>
        {description && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{description}</span>}
      </div>
      <input 
        type="checkbox" 
        id={id} 
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
      />
    </div>
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }} className="animate-fade-in">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', fontSize: '2rem' }}>
        <SettingsIcon size={32} color="var(--accent-color)" /> Settings
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* GAME PREFERENCES */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent-color)' }}>Game Preferences</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <ToggleRow 
              id="sounds" 
              label="Enable Move Sounds" 
              description="Play sound effects during gameplay."
              checked={settings.soundsEnabled}
              onChange={(val) => updateSetting('soundsEnabled', val)}
            />
            <ToggleRow 
              id="autoQueen" 
              label="Auto-Queen Promotion" 
              description="Automatically promote pawns to Queens without asking."
              checked={settings.autoQueenPromotion}
              onChange={(val) => updateSetting('autoQueenPromotion', val)}
            />
            <ToggleRow 
              id="showLegalMoves" 
              label="Show Legal Moves" 
              description="Highlight valid destination squares when dragging a piece."
              checked={settings.showLegalMoves}
              onChange={(val) => updateSetting('showLegalMoves', val)}
            />
            <ToggleRow 
              id="confirmResign" 
              label="Confirm Resignation" 
              description="Require confirmation before resigning a game."
              checked={settings.confirmResign}
              onChange={(val) => updateSetting('confirmResign', val)}
            />
            <ToggleRow 
              id="showCoordinates" 
              label="Show Board Coordinates" 
              description="Display rank and file labels on the board."
              checked={settings.showCoordinates}
              onChange={(val) => updateSetting('showCoordinates', val)}
            />
          </div>
        </div>

        {/* NOTIFICATIONS */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent-color)' }}>Notifications</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <ToggleRow 
              id="challengeAlerts" 
              label="Incoming Challenge Alerts" 
              description="Show a popup when someone challenges you."
              checked={settings.challengeAlerts}
              onChange={(val) => updateSetting('challengeAlerts', val)}
            />
            <ToggleRow 
              id="friendRequestAlerts" 
              label="Friend Request Alerts" 
              description="Show a notification for new friend requests."
              checked={settings.friendRequestAlerts}
              onChange={(val) => updateSetting('friendRequestAlerts', val)}
            />
          </div>
        </div>

        {/* PRIVACY */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--accent-color)', margin: 0 }}>Privacy</h3>
            {privacyMsg && <span style={{ color: '#10b981', fontSize: '0.9rem' }}>{privacyMsg}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <label htmlFor="showOnline" style={{ fontWeight: 'bold', display: 'block', cursor: 'pointer' }}>Show Online Status</label>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Allow friends to see when you are online.</span>
              </div>
              <input 
                type="checkbox" 
                id="showOnline" 
                checked={showOnlineStatus}
                onChange={handleToggleOnlineStatus}
                style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* ACCOUNT */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent-color)' }}>Account Settings</h3>
          
          <div style={{ marginBottom: '2rem' }}>
            <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-primary)', textDecoration: 'none', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', transition: 'background 0.2s' }} className="hover-bg-light">
              <LinkIcon size={20} color="var(--accent-color)" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 'bold' }}>Manage Linked Accounts</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>View or disconnect OAuth providers in your Profile.</span>
              </div>
            </Link>
          </div>

          {hasPassword && (
            <div>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '1.1rem' }}>
                <Lock size={18} /> Change Password
              </h4>
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <input 
                  type="password" 
                  placeholder="Current Password"
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords({...passwords, currentPassword: e.target.value})}
                  className="input-field"
                  style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
                <input 
                  type="password" 
                  placeholder="New Password"
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                  className="input-field"
                  style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button type="submit" className="btn" style={{ background: 'var(--accent-color)', padding: '0.75rem 1.5rem', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                    Update Password
                  </button>
                  {passwordMsg.text && (
                    <span style={{ color: passwordMsg.type === 'error' ? '#ef4444' : '#10b981', fontSize: '0.9rem' }}>
                      {passwordMsg.text}
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>

      </div>

      <style>{`
        .hover-bg-light:hover {
          background: rgba(255,255,255,0.06) !important;
        }
      `}</style>
    </div>
  );
}
