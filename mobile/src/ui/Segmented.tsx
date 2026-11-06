import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Txt } from './primitives';
import { radius, useColors } from './theme';

type Option<T extends string> = { value: T; label: string; icon?: string };

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange(value: T): void;
}) {
  const c = useColors();
  return (
    <View style={[styles.root, { borderColor: c.lineStrong }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.item, active && { backgroundColor: c.ink }]}
          >
            {o.icon ? <Icon name={o.icon} size={18} color={active ? c.paper : c.inkSoft} /> : null}
            <Txt variant="label" color={active ? c.paper : c.inkSoft}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.pill, padding: 3 },
  item: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
