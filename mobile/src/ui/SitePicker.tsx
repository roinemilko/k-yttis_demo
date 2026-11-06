import { Pressable, StyleSheet, View } from 'react-native';

import { useHome } from '../data/HomeProvider';
import type { SiteSummary } from '../data/types';
import { Icon, Sheet, Txt } from './primitives';
import { space, useColors } from './theme';

const SITE_ICONS: Record<string, string> = { koti: 'home-variant-outline', mokki: 'cabin-a-frame' };

export function summaryText(s: SiteSummary): string {
  if (s.status === 'attention') return s.attentionCount === 1 ? '1 asia vaatii huomiota' : `${s.attentionCount} asiaa vaatii huomiota`;
  if (s.status === 'info') return s.infoCount === 1 ? 'Kunnossa, 1 valo päällä' : `Kunnossa, ${s.infoCount} valoa päällä`;
  return 'Kaikki kunnossa';
}

export function SitePicker({ visible, onClose }: { visible: boolean; onClose(): void }) {
  const c = useColors();
  const { snapshot, selectSite, track } = useHome();
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Txt variant="title" style={styles.title}>
        Kohteet
      </Txt>
      {snapshot?.sites.map((s) => {
        const selected = s.id === snapshot.site.id;
        return (
          <Pressable
            key={s.id}
            onPress={() => {
              selectSite(s.id);
              track('site', `Kohde: ${s.name}`);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.row, { borderBottomColor: c.line }, pressed && { backgroundColor: c.line }]}
          >
            <Icon name={SITE_ICONS[s.id] ?? 'home-outline'} size={26} color={c.ink} />
            <View style={styles.grow}>
              <Txt variant="label">{s.name}</Txt>
              <Txt variant="caption" color={s.status === 'attention' ? c.signal : c.inkSoft}>
                {summaryText(s)}
              </Txt>
            </View>
            {selected ? <Icon name="check" size={22} color={c.ink} /> : null}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  grow: { flex: 1 },
});
