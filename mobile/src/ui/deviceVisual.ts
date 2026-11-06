import catalogJson from '../../../shared/device-types.json';
import type { Catalog, Device } from '../data/types';
import type { Colors } from './theme';

const catalog = catalogJson as Catalog;

export const categories = catalog.categories;

const STATE_ICONS: Record<string, Record<string, string>> = {
  door_lock: { unlocked: 'lock-open-variant' },
  garage_door: { open: 'garage-open' },
  light: { on: 'lightbulb-on', off: 'lightbulb-outline' },
  fridge_door: { open: 'fridge-alert-outline' },
};

export const deviceIcon = (d: Device) => STATE_ICONS[d.type]?.[d.state] ?? d.icon;

export type Tone = 'alert' | 'glow' | 'calm';

/** alert = vaatii huomiota, glow = valo päällä, calm = kunnossa */
export function deviceTone(d: Device): Tone {
  if (!d.needsAttention) return 'calm';
  return d.severity === 'low' ? 'glow' : 'alert';
}

export function toneColors(tone: Tone, c: Colors) {
  switch (tone) {
    case 'alert':
      return { bg: c.signal, border: c.signal, icon: c.onSignal, text: c.signal };
    case 'glow':
      return { bg: c.glowTint, border: c.glow, icon: c.glowInk, text: c.glowInk };
    default:
      return { bg: c.surface, border: c.lineStrong, icon: c.muted, text: c.inkSoft };
  }
}
