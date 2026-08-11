import { Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }} className="animate-fade-in">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', fontSize: '2rem' }}>
        <SettingsIcon size={32} color="var(--accent-color)" /> Settings
      </h2>
      
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          More settings will be available in a future update.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h4 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>Theme Preferences</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <input type="radio" id="dark" name="theme" defaultChecked />
              <label htmlFor="dark">Dark Mode (Default)</label>
            </div>
          </div>
          
          <div>
            <h4 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>Board Preferences</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <input type="checkbox" id="sounds" defaultChecked />
              <label htmlFor="sounds">Enable Move Sounds</label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
