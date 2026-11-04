import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as settingsService from '../services/settingsService';
import { useAuth } from './AuthContext';
import { canViewRatings, ratingsHiddenReason } from '../utils/roles';
import { Loading, ErrorState } from '../components/Feedback';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    settingsService.getSettings()
      .then((value) => { if (active) { setSettings(value); setError(null); } })
      .catch((reason) => { if (active) setError(reason); });
    return () => { active = false; };
  }, []);

  const setRatingsVisible = useCallback(async (visible) => setSettings(await settingsService.setRatingsVisible(user, visible)), [user]);
  const setResultsPublished = useCallback(async (published) => setSettings(await settingsService.setResultsPublished(user, published)), [user]);
  const refresh = useCallback(async () => {
    try {
      const value = await settingsService.getSettings();
      setSettings(value);
      setError(null);
    } catch (reason) {
      setError(reason);
      throw reason;
    }
  }, []);

  const value = useMemo(
    () => ({
      settings,
      ratingsShown: settings ? canViewRatings(user, settings) : false,
      ratingsHiddenReason: settings ? ratingsHiddenReason(user, settings) : '',
      setRatingsVisible,
      setResultsPublished,
      refresh,
    }),
    [settings, user, setRatingsVisible, setResultsPublished, refresh]
  );

  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (!settings) return <Loading label="Loading settings…" />;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
