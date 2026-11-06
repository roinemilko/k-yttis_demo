import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import type { Device, Site } from '../data/types';
import { deviceIcon, deviceTone, toneColors } from './deviceVisual';
import { Icon, Txt } from './primitives';
import { space, useColors } from './theme';

const MARKER = { alert: 36, glow: 30, calm: 26 };
const LEGEND_HEIGHT = 40;

export function FloorPlan({ site, onSelect }: { site: Site; onSelect(deviceId: string): void }) {
  const c = useColors();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const { plan } = site;
  const scale = box ? Math.min(box.w / plan.width, (box.h - LEGEND_HEIGHT) / plan.height) : 0;
  const litRooms = new Set(site.devices.filter((d) => deviceTone(d) === 'glow').map((d) => d.roomId));

  return (
    <View style={styles.fill} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box && scale > 0 ? (
        <>
          <View style={{ width: plan.width * scale, height: plan.height * scale, alignSelf: 'center' }}>
            <Svg width={plan.width * scale} height={plan.height * scale} viewBox={`0 0 ${plan.width} ${plan.height}`}>
              {plan.rooms.map((r) => (
                <Rect
                  key={r.id}
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  fill={litRooms.has(r.id) ? c.glowTint : 'transparent'}
                  stroke={c.lineStrong}
                  strokeWidth={1.5 / scale}
                />
              ))}
              <Rect x={0} y={0} width={plan.width} height={plan.height} fill="none" stroke={c.wall} strokeWidth={4 / scale} />
            </Svg>
            {plan.rooms.map((r) => (
              <Txt
                key={r.id}
                variant="caption"
                color={c.muted}
                style={[styles.roomCode, { left: r.x * scale + 7, top: r.y * scale + 5 }]}
                accessibilityLabel={r.name}
              >
                {r.code}
              </Txt>
            ))}
            {site.devices.map((d) => (
              <Marker key={d.id} device={d} scale={scale} onPress={() => onSelect(d.id)} />
            ))}
          </View>
          <Legend />
        </>
      ) : null}
    </View>
  );
}

function Marker({ device, scale, onPress }: { device: Device; scale: number; onPress(): void }) {
  const c = useColors();
  const tone = deviceTone(device);
  const colors = toneColors(tone, c);
  const size = MARKER[tone];
  return (
    <View style={[styles.marker, { left: device.x * scale - size / 2, top: device.y * scale - size / 2, width: size, height: size }]}>
      {tone === 'alert' ? <Pulse size={size} color={c.signal} /> : null}
      <Pressable
        onPress={onPress}
        hitSlop={Math.max(0, (44 - size) / 2)}
        accessibilityRole="button"
        accessibilityLabel={`${device.name}, ${device.stateLabel}`}
        style={({ pressed }) => [
          styles.markerDot,
          { width: size, height: size, backgroundColor: colors.bg, borderColor: colors.border },
          pressed && { transform: [{ scale: 0.92 }] },
        ]}
      >
        <Icon name={deviceIcon(device)} size={size * 0.56} color={colors.icon} />
      </Pressable>
    </View>
  );
}

/** Ainoa jatkuva animaatio: hälyttävän laitteen ympärillä laajeneva rengas. */
function Pulse({ size, color }: { size: number; color: string }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion]);

  if (reduceMotion) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: color,
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
        },
      ]}
    />
  );
}

function Legend() {
  const c = useColors();
  const items = [
    { label: 'Vaatii huomiota', ...toneColors('alert', c) },
    { label: 'Valo päällä', ...toneColors('glow', c) },
    { label: 'Kunnossa', ...toneColors('calm', c) },
  ];
  return (
    <View style={styles.legend}>
      {items.map((i) => (
        <View key={i.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: i.bg, borderColor: i.border }]} />
          <Txt variant="caption" color={c.inkSoft}>
            {i.label}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  roomCode: { position: 'absolute', letterSpacing: 0.6 },
  marker: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  markerDot: { borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  legend: { height: LEGEND_HEIGHT, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
});
