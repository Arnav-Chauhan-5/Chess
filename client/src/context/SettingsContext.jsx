import React, { createContext, useContext, useState, useEffect } from 'react';

const defaultSettings = {
  soundsEnabled: true,
  autoQueenPromotion: false,
  showLegalMoves: true,
  confirmResign: true,
  showCoordinates: true,
  friendRequestAlerts: true,
  challengeAlerts: true,
  moveInputStyle: 'both',
  theme: 'dark', // 'dark' | 'system'
};

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem('chess_settings');
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
      
      // Migrate old setting if present
      const oldSoundsEnabled = localStorage.getItem('chess_sounds_enabled');
      if (oldSoundsEnabled !== null) {
        const migratedSettings = { ...defaultSettings, soundsEnabled: oldSoundsEnabled === 'true' };
        localStorage.setItem('chess_settings', JSON.stringify(migratedSettings));
        localStorage.removeItem('chess_sounds_enabled');
        return migratedSettings;
      }
    } catch (e) {
      console.error('Failed to parse settings', e);
    }
    return defaultSettings;
  });

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('chess_settings', JSON.stringify(settings));
  }, [settings]);

  // Apply theme to document body
  useEffect(() => {
    const applyTheme = (theme) => {
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.dataset.theme = prefersDark ? 'dark' : 'dark'; // Light palette not built yet — keep dark
      } else {
        document.body.dataset.theme = theme;
      }
    };

    applyTheme(settings.theme);

    // Listen for system preference changes when in 'system' mode
    let mql = null;
    const handleSystemChange = (e) => {
      if (settings.theme === 'system') {
        document.body.dataset.theme = 'dark'; // Light palette stub — always dark for now
      }
    };

    if (settings.theme === 'system') {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', handleSystemChange);
    }

    return () => {
      if (mql) mql.removeEventListener('change', handleSystemChange);
    };
  }, [settings.theme]);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
