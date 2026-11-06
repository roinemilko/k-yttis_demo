// Paikallinen versio backendin logiikasta (backend/app/store.py), jotta sovellus toimii ilman palvelinta.
// Pidä säännöt samoina molemmissa.

import catalogJson from '../../../shared/device-types.json';
import scenariosJson from '../../../shared/scenarios.json';
import sitesJson from '../../../shared/sites.json';
import type { HomeSource } from './source';
import {
  ApiError,
  type Action,
  type Catalog,
  type Config,
  type ConfigPatch,
  type Device,
  type DeviceSeed,
  type DeviceType,
  type FacilitatorOverview,
  type Scenario,
  type Site,
  type SiteSeed,
  type SiteSummary,
  type Snapshot,
} from './types';

const catalog = catalogJson as Catalog;
const sites = sitesJson.sites as SiteSeed[];
const scenarios = scenariosJson.scenarios as Scenario[];
const initialScenario = scenariosJson.initialScenario;

const IDLE_AGE_MS = 3 * 60 * 60 * 1000;
const DEFAULT_CONFIG: Config = { controlsEnabled: false, defaultView: 'floorplan', activeSiteId: 'koti' };

type DeviceState = { state: string; changedAt: number };

const devicesById = new Map<string, { siteId: string; device: DeviceSeed }>(
  sites.flatMap((s) => s.devices.map((d) => [d.id, { siteId: s.id, device: d }] as const)),
);

const typeOf = (device: DeviceSeed): DeviceType => catalog.types[device.type];

export class LocalHome implements HomeSource {
  private config: Config = { ...DEFAULT_CONFIG };
  private states = new Map<string, DeviceState>();
  private activeScenarioId: string | null = null;
  private revision = 0;
  // Kasvavat myös nollauksen yli, kuten backendissä.
  private siteFocus = 0;
  private viewFocus = 0;

  constructor() {
    this.resetSync();
  }

  async snapshot(siteId?: string): Promise<Snapshot> {
    return {
      config: { ...this.config },
      sites: sites.map((s) => this.summary(s)),
      site: this.site(siteId ?? this.config.activeSiteId),
      revision: this.revision,
      siteFocus: this.siteFocus,
      viewFocus: this.viewFocus,
    };
  }

  async setDeviceState(deviceId: string, state: string): Promise<Device> {
    const { device } = this.getDevice(deviceId);
    const type = typeOf(device);
    if (!(state in type.states)) throw new ApiError(`Laitteella ${device.name} ei ole tilaa '${state}'`, 422);
    if (!this.config.controlsEnabled) throw new ApiError('Laitteiden ohjaus ei ole käytössä', 403);
    const current = this.states.get(deviceId)!.state;
    if (state !== current) {
      if (!this.allowedActions(type, current).some((a) => a.state === state)) {
        throw new ApiError(`${device.name}: tilaan '${type.states[state]}' ei voi vaihtaa sovelluksesta`, 409);
      }
      this.set(deviceId, state);
    }
    return this.deviceOut(deviceId);
  }

  async lightsOff(siteId: string): Promise<Site> {
    const site = this.getSite(siteId);
    if (!this.config.controlsEnabled) throw new ApiError('Laitteiden ohjaus ei ole käytössä', 403);
    for (const device of site.devices) {
      const type = typeOf(device);
      if (type.category === 'lights' && this.states.get(device.id)!.state !== type.safeState) {
        this.set(device.id, type.safeState);
      }
    }
    return this.site(siteId);
  }

  async overview(): Promise<FacilitatorOverview> {
    return {
      config: { ...this.config },
      sites: sites.map((s) => this.summary(s)),
      scenarios,
      activeScenarioId: this.activeScenarioId,
      revision: this.revision,
    };
  }

  async updateConfig(patch: ConfigPatch): Promise<Config> {
    if (patch.activeSiteId) this.getSite(patch.activeSiteId);
    this.config = { ...this.config, ...patch };
    if (patch.activeSiteId) this.siteFocus += 1;
    if (patch.defaultView) this.viewFocus += 1;
    this.revision += 1;
    return { ...this.config };
  }

  async applyScenario(scenarioId: string): Promise<FacilitatorOverview> {
    if (!scenarios.some((s) => s.id === scenarioId)) throw new ApiError(`Skenaariota '${scenarioId}' ei ole`, 404);
    this.applyScenarioSync(scenarioId);
    return this.overview();
  }

  async reset(): Promise<FacilitatorOverview> {
    this.resetSync();
    return this.overview();
  }

  logUsage() {
    // Paikallisessa tilassa ei ole testinohjaajaa, joka lukisi lokia.
  }

  private resetSync() {
    this.config = { ...DEFAULT_CONFIG };
    this.states.clear();
    this.revision = 0;
    this.applyScenarioSync(initialScenario);
    this.siteFocus += 1;
    this.viewFocus += 1;
  }

  private applyScenarioSync(scenarioId: string) {
    const scenario = scenarios.find((s) => s.id === scenarioId)!;
    const now = Date.now();
    for (const [id, { device }] of devicesById) {
      this.states.set(id, { state: typeOf(device).safeState, changedAt: now - IDLE_AGE_MS });
    }
    for (const [id, change] of Object.entries(scenario.devices)) {
      this.states.set(id, { state: change.state, changedAt: now - (change.minutesAgo ?? 0) * 60_000 });
    }
    if (scenario.siteId) {
      this.config = { ...this.config, activeSiteId: scenario.siteId };
      this.siteFocus += 1;
    }
    this.activeScenarioId = scenarioId;
    this.revision += 1;
  }

  private set(deviceId: string, state: string) {
    this.states.set(deviceId, { state, changedAt: Date.now() });
    this.activeScenarioId = null;
    this.revision += 1;
  }

  private getSite(siteId: string): SiteSeed {
    const site = sites.find((s) => s.id === siteId);
    if (!site) throw new ApiError(`Kohdetta '${siteId}' ei ole`, 404);
    return site;
  }

  private getDevice(deviceId: string) {
    const entry = devicesById.get(deviceId);
    if (!entry) throw new ApiError(`Laitetta '${deviceId}' ei ole`, 404);
    return entry;
  }

  private allowedActions(type: DeviceType, state: string): Action[] {
    if (!this.config.controlsEnabled || type.control === 'none') return [];
    const targets =
      type.control === 'safe_only'
        ? state !== type.safeState
          ? [type.safeState]
          : []
        : Object.keys(type.states).filter((s) => s !== state);
    return targets.filter((s) => s in type.actions).map((s) => ({ state: s, label: type.actions[s] }));
  }

  private deviceOut(deviceId: string): Device {
    const { siteId, device } = devicesById.get(deviceId)!;
    const type = typeOf(device);
    const current = this.states.get(deviceId)!;
    return {
      id: device.id,
      siteId,
      roomId: device.roomId,
      type: device.type,
      name: device.name,
      icon: type.icon,
      category: type.category,
      severity: type.severity,
      x: device.x,
      y: device.y,
      state: current.state,
      stateLabel: type.states[current.state],
      safeState: type.safeState,
      needsAttention: current.state !== type.safeState,
      changedAt: new Date(current.changedAt).toISOString(),
      actions: this.allowedActions(type, current.state),
    };
  }

  private summary(site: SiteSeed): SiteSummary {
    const devices = site.devices.map((d) => this.deviceOut(d.id));
    const attention = devices.filter((d) => d.needsAttention && d.severity !== 'low').length;
    const info = devices.filter((d) => d.needsAttention && d.severity === 'low').length;
    return {
      id: site.id,
      name: site.name,
      status: attention ? 'attention' : info ? 'info' : 'ok',
      attentionCount: attention,
      infoCount: info,
      deviceCount: devices.length,
    };
  }

  private site(siteId: string): Site {
    const site = this.getSite(siteId);
    return {
      ...this.summary(site),
      plan: site.plan,
      devices: site.devices.map((d) => this.deviceOut(d.id)),
      revision: this.revision,
    };
  }
}
