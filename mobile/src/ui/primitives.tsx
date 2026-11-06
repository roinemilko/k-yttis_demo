import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, space, useColors } from './theme';

export type IconName = ComponentProps<typeof MaterialDesignIcons>['name'];

export function Icon({ name, size = 20, color }: { name: string; size?: number; color: string }) {
  return <MaterialDesignIcons name={name as IconName} size={size} color={color} />;
}

type Variant = 'hero' | 'title' | 'body' | 'label' | 'caption';

const variants: Record<Variant, TextStyle> = {
  hero: { fontFamily: font.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.3 },
  title: { fontFamily: font.bold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: font.medium, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
};

export function Txt({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return <Text {...rest} style={[variants[variant], { color: color ?? c.ink }, style]} />;
}

export function PillButton({
  label,
  onPress,
  kind = 'secondary',
  busy = false,
  icon,
  style,
}: {
  label: string;
  onPress(): void;
  kind?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = kind === 'primary' ? c.ink : kind === 'danger' ? c.signal : 'transparent';
  const fg = kind === 'primary' ? c.paper : kind === 'danger' ? c.onSignal : c.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: bg, borderColor: kind === 'secondary' ? c.lineStrong : bg },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.85 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          <Txt variant="label" color={fg} numberOfLines={1}>
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

/** Alalaatikko. Sulkeutuu taustaa napauttamalla tai Androidin takaisin-eleellä. */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose(): void; children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.sheetRoot}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="Sulje" />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + space.xl }]}>
          <View style={[styles.handle, { backgroundColor: c.lineStrong }]} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.gutter + 4,
    paddingTop: space.md,
    maxHeight: '88%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: space.lg },
});
