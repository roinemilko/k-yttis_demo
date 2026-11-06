import type { HomeSource } from './source';
import { ApiError, type Config, type ConfigPatch, type Device, type FacilitatorOverview, type Site, type Snapshot } from './types';

const TIMEOUT_MS = 4000;

export class RemoteHome implements HomeSource {
  private readonly baseUrl: string;

  constructor(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  snapshot(siteId?: string) {
    return this.request<Snapshot>('GET', siteId ? `/api/snapshot?siteId=${encodeURIComponent(siteId)}` : '/api/snapshot');
  }

  setDeviceState(deviceId: string, state: string) {
    return this.request<Device>('POST', `/api/devices/${encodeURIComponent(deviceId)}/state`, { state });
  }

  lightsOff(siteId: string) {
    return this.request<Site>('POST', `/api/sites/${encodeURIComponent(siteId)}/lights-off`);
  }

  overview() {
    return this.request<FacilitatorOverview>('GET', '/api/facilitator');
  }

  updateConfig(patch: ConfigPatch) {
    return this.request<Config>('PATCH', '/api/facilitator/config', patch);
  }

  applyScenario(scenarioId: string) {
    return this.request<FacilitatorOverview>('POST', `/api/facilitator/scenarios/${encodeURIComponent(scenarioId)}/apply`);
  }

  reset() {
    return this.request<FacilitatorOverview>('POST', '/api/facilitator/reset');
  }

  logUsage(kind: string, message: string, deviceId?: string) {
    this.request('POST', '/api/events', { kind, message, deviceId }).catch(() => {});
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(this.baseUrl + path, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(`Palvelimeen ${this.baseUrl} ei saada yhteyttä`, 0);
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      const detail = await response.json().then((j) => j?.detail, () => undefined);
      throw new ApiError(typeof detail === 'string' ? detail : `Palvelin vastasi virheellä ${response.status}`, response.status);
    }
    return (response.status === 204 ? undefined : response.json()) as Promise<T>;
  }
}
