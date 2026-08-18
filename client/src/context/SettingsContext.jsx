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

  useEffect(() => {
    localStorage.setItem('chess_settings', JSON.stringify(settings));
  }, [settings]);

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
