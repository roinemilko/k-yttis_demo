import type { Config, ConfigPatch, Device, FacilitatorOverview, Site, Snapshot } from './types';

/** Sama rajapinta paikalliselle mockille ja oikealle palvelimelle. */
export interface HomeSource {
  snapshot(siteId?: string): Promise<Snapshot>;
  setDeviceState(deviceId: string, state: string): Promise<Device>;
  lightsOff(siteId: string): Promise<Site>;
  overview(): Promise<FacilitatorOverview>;
  updateConfig(patch: ConfigPatch): Promise<Config>;
  applyScenario(scenarioId: string): Promise<FacilitatorOverview>;
  reset(): Promise<FacilitatorOverview>;
  /** Käyttötapahtuma testinohjaajan lokiin. Ei koskaan heitä virhettä. */
  logUsage(kind: string, message: string, deviceId?: string): void;
}

export type SourceSetting = { mode: 'local' } | { mode: 'remote'; url: string };
