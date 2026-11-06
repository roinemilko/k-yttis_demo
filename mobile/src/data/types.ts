// Vastaa backendin rajapintaa (backend/app/models.py). Kentät camelCase kuten JSONissa.

export type Severity = 'high' | 'medium' | 'low';
export type ControlMode = 'none' | 'safe_only' | 'both';
export type ViewMode = 'floorplan' | 'list';
export type SiteStatus = 'ok' | 'info' | 'attention';

export type Category = { id: string; name: string };

export type DeviceType = {
  name: string;
  category: string;
  risk: string;
  severity: Severity;
  states: Record<string, string>;
  safeState: string;
  control: ControlMode;
  actions: Record<string, string>;
  icon: string;
};

export type Catalog = { categories: Category[]; types: Record<string, DeviceType> };

export type Room = { id: string; code: string; name: string; x: number; y: number; w: number; h: number };
export type Plan = { width: number; height: number; rooms: Room[] };

export type DeviceSeed = { id: string; type: string; name: string; roomId: string; x: number; y: number };
export type SiteSeed = { id: string; name: string; plan: Plan; devices: DeviceSeed[] };

export type Scenario = {
  id: string;
  name: string;
  description: string;
  siteId?: string | null;
  devices: Record<string, { state: string; minutesAgo?: number }>;
};

export type Config = { controlsEnabled: boolean; defaultView: ViewMode; activeSiteId: string };
export type ConfigPatch = Partial<Config>;

export type Action = { state: string; label: string };

export type Device = {
  id: string;
  siteId: string;
  roomId: string;
  type: string;
  name: string;
  icon: string;
  category: string;
  severity: Severity;
  x: number;
  y: number;
  state: string;
  stateLabel: string;
  safeState: string;
  needsAttention: boolean;
  changedAt: string;
  actions: Action[];
};

export type SiteSummary = {
  id: string;
  name: string;
  status: SiteStatus;
  attentionCount: number;
  infoCount: number;
  deviceCount: number;
};

export type Site = SiteSummary & { plan: Plan; devices: Device[]; revision: number };

export type Snapshot = {
  config: Config;
  sites: SiteSummary[];
  site: Site;
  revision: number;
  /** Kun luku muuttuu, puhelin siirtyy ohjaajan valitsemaan kohteeseen tai aloitusnäkymään. */
  siteFocus: number;
  viewFocus: number;
};

export type FacilitatorOverview = {
  config: Config;
  sites: SiteSummary[];
  scenarios: Scenario[];
  activeScenarioId: string | null;
  revision: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
