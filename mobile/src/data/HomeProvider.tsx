import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { LocalHome } from './local';
import { RemoteHome } from './remote';
import type { HomeSource, SourceSetting } from './source';
import { ApiError, type ConfigPatch, type FacilitatorOverview, type Snapshot, type ViewMode } from './types';

const SOURCE_KEY = 'kotipaneeli.source';
const POLL_MS = 2000;

const envUrl = process.env.EXPO_PUBLIC_API_URL;
const DEFAULT_SOURCE: SourceSetting = envUrl ? { mode: 'remote', url: envUrl } : { mode: 'local' };

// Paikallinen tila säilyy, vaikka testiasetuksista käytäisiin välillä palvelimella.
const localHome = new LocalHome();

type HomeContextValue = {
  snapshot: Snapshot | null;
  connectionError: string | null;
  source: SourceSetting;
  setSource(source: SourceSetting): void;
  siteId: string | null;
  selectSite(siteId: string): void;
  view: ViewMode;
  setView(view: ViewMode): void;
  setDeviceState(deviceId: string, state: string): Promise<void>;
  lightsOff(): Promise<void>;
  refresh(): Promise<void>;
  loadOverview(): Promise<FacilitatorOverview>;
  updateConfig(patch: ConfigPatch): Promise<void>;
  applyScenario(scenarioId: string): Promise<void>;
  reset(): Promise<void>;
  track(kind: string, message: string, deviceId?: string): void;
};

const HomeContext = createContext<HomeContextValue | null>(null);

export function HomeProvider({ children }: { children: ReactNode }) {
  const [source, setSourceState] = useState<SourceSetting>(DEFAULT_SOURCE);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('floorplan');

  const home: HomeSource = useMemo(
    () => (source.mode === 'local' ? localHome : new RemoteHome(source.url)),
    [source],
  );

  // Testinohjaajan vaihtama kohde tai aloitusnäkymä otetaan käyttöön, kun se muuttuu.
  const seenFocus = useRef<{ site: number; view: number } | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(SOURCE_KEY)
      .then((saved) => saved && setSourceState(JSON.parse(saved) as SourceSetting))
      .catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const next = await home.snapshot(siteId ?? undefined);
      if (id !== requestId.current) return;
      const seen = seenFocus.current;
      if (!seen || seen.site !== next.siteFocus) setSiteId(next.config.activeSiteId);
      if (!seen || seen.view !== next.viewFocus) setView(next.config.defaultView);
      seenFocus.current = { site: next.siteFocus, view: next.viewFocus };
      setSnapshot(next);
      setConnectionError(null);
    } catch (e) {
      if (id !== requestId.current) return;
      setConnectionError(e instanceof Error ? e.message : String(e));
    }
  }, [home, siteId]);

  useEffect(() => {
    // refresh asettaa tilan vasta awaitin jälkeen, joten renderöintiketjua ei synny.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    if (source.mode !== 'remote') return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh, source.mode]);

  const setSource = useCallback((next: SourceSetting) => {
    seenFocus.current = null;
    setSnapshot(null);
    setConnectionError(null);
    setSiteId(null);
    setSourceState(next);
    AsyncStorage.setItem(SOURCE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const value = useMemo<HomeContextValue>(
    () => ({
      snapshot,
      connectionError,
      source,
      setSource,
      siteId,
      selectSite: setSiteId,
      view,
      setView,
      refresh,
      async setDeviceState(deviceId, state) {
        await home.setDeviceState(deviceId, state);
        await refresh();
      },
      async lightsOff() {
        if (!snapshot) return;
        await home.lightsOff(snapshot.site.id);
        await refresh();
      },
      loadOverview: () => home.overview(),
      async updateConfig(patch) {
        await home.updateConfig(patch);
        await refresh();
      },
      async applyScenario(scenarioId) {
        await home.applyScenario(scenarioId);
        await refresh();
      },
      async reset() {
        await home.reset();
        await refresh();
      },
      track: (kind, message, deviceId) => home.logUsage(kind, message, deviceId),
    }),
    [snapshot, connectionError, source, setSource, siteId, view, home, refresh],
  );

  return <HomeContext.Provider value={value}>{children}</HomeContext.Provider>;
}

export function useHome(): HomeContextValue {
  const value = useContext(HomeContext);
  if (!value) throw new Error('useHome vaatii HomeProviderin');
  return value;
}

export function errorMessage(e: unknown): string {
  return e instanceof ApiError || e instanceof Error ? e.message : String(e);
}
