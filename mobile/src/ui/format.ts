import type { Device, Site } from '../data/types';

export function duration(fromIso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(fromIso)) / 60_000));
  if (minutes < 1) return 'hetki';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} pv ${hours % 24} h` : `${days} pv`;
}

export function clockTime(iso: string, now: number): string {
  const date = new Date(iso);
  const time = `${date.getHours()}.${String(date.getMinutes()).padStart(2, '0')}`;
  const today = new Date(now);
  if (date.toDateString() === today.toDateString()) return `klo ${time}`;
  const yesterday = new Date(now - 86_400_000);
  if (date.toDateString() === yesterday.toDateString()) return `eilen klo ${time}`;
  return `${date.getDate()}.${date.getMonth() + 1}. klo ${time}`;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "Kahvinkeitin päällä", "Terassin ovi lukitsematta" */
export const deviceStatePhrase = (d: Device) => `${d.name} ${lowerFirst(d.stateLabel)}`;

function joinFi(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} ja ${parts[parts.length - 1]}`;
}

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

export function byUrgency(a: Device, b: Device): number {
  return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || Date.parse(a.changedAt) - Date.parse(b.changedAt);
}

export type SiteStatusText = { tone: 'ok' | 'attention'; headline: string; detail: string };

export function siteStatusText(site: Site, now: number): SiteStatusText {
  const attention = site.devices.filter((d) => d.needsAttention && d.severity !== 'low').sort(byUrgency);
  const lights = site.devices.filter((d) => d.needsAttention && d.severity === 'low');

  const lightsLine =
    lights.length === 0 ? '' : lights.length === 1 ? `${lights[0].name} jäivät päälle.` : `${lights.length} valoa jäi päälle.`;

  if (attention.length === 0) {
    const has = (pred: (d: Device) => boolean) => site.devices.some(pred);
    const reassurance = joinFi(
      [
        has((d) => d.category === 'appliances' && d.type !== 'water_valve') && 'kodinkoneet pois päältä',
        has((d) => d.type === 'water_valve') && 'hanat kiinni',
        has((d) => d.category === 'doors') && 'ovet lukossa',
      ].filter((p): p is string => Boolean(p)),
    );
    const detail = reassurance ? `${reassurance.charAt(0).toUpperCase()}${reassurance.slice(1)}.` : '';
    return { tone: 'ok', headline: 'Kaikki kunnossa', detail: [detail, lightsLine].filter(Boolean).join(' ') };
  }

  const extra = lights.length ? (lights.length === 1 ? `Lisäksi ${lowerFirst(lights[0].name)} päällä.` : `Lisäksi ${lights.length} valoa päällä.`) : '';

  if (attention.length === 1) {
    const d = attention[0];
    return {
      tone: 'attention',
      headline: deviceStatePhrase(d),
      detail: [`${roomName(site, d.roomId)}, ${clockTime(d.changedAt, now)} alkaen (${duration(d.changedAt, now)}).`, extra]
        .filter(Boolean)
        .join(' '),
    };
  }

  const named = attention.slice(0, attention.length > 3 ? 2 : 3).map((d, i) => (i === 0 ? deviceStatePhrase(d) : lowerFirst(deviceStatePhrase(d))));
  const rest = attention.length - named.length;
  const list = rest > 0 ? `${named.join(', ')} ja ${rest} muuta` : joinFi(named);
  return {
    tone: 'attention',
    headline: `${attention.length} asiaa vaatii huomiota`,
    detail: [`${list}.`, extra].filter(Boolean).join(' '),
  };
}

export const roomName = (site: Site, roomId: string) => site.plan.rooms.find((r) => r.id === roomId)?.name ?? '';
