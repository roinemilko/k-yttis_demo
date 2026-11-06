import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { errorMessage, useHome } from '../data/HomeProvider';
import type { Device, Site } from '../data/types';
import { categories, deviceIcon, deviceTone, toneColors } from './deviceVisual';
import { byUrgency, duration, roomName } from './format';
import { Icon, PillButton, Txt } from './primitives';
import { space, useColors } from './theme';

export function DeviceList({
  site,
  now,
  onSelect,
  onError,
}: {
  site: Site;
  now: number;
  onSelect(deviceId: string): void;
  onError(message: string): void;
}) {
  const c = useColors();
  const { lightsOff } = useHome();
  const attention = site.devices.filter((d) => deviceTone(d) === 'alert').sort(byUrgency);
  const lights = site.devices.filter((d) => deviceTone(d) === 'glow').sort(byUrgency);
  const fine = site.devices.filter((d) => !d.needsAttention);
  const [showFine, setShowFine] = useState(attention.length + lights.length === 0);
  const [busyAll, setBusyAll] = useState(false);
  const canSwitchOffLights = lights.length > 1 && lights.some((d) => d.actions.some((a) => a.state === d.safeState));

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {attention.length > 0 ? (
        <Section title="Vaatii huomiota">
          {attention.map((d) => (
            <DeviceRow key={d.id} device={d} site={site} now={now} onPress={() => onSelect(d.id)} onError={onError} />
          ))}
        </Section>
      ) : null}

      {lights.length > 0 ? (
        <Section title="Valot päällä">
          {lights.map((d) => (
            <DeviceRow key={d.id} device={d} site={site} now={now} onPress={() => onSelect(d.id)} onError={onError} />
          ))}
          {canSwitchOffLights ? (
            <PillButton
              label="Sammuta kaikki valot"
              icon="lightbulb-off-outline"
              busy={busyAll}
              style={styles.allLights}
              onPress={async () => {
                setBusyAll(true);
                try {
                  await lightsOff();
                } catch (e) {
                  onError(errorMessage(e));
                } finally {
                  setBusyAll(false);
                }
              }}
            />
          ) : null}
        </Section>
      ) : null}

      <Pressable
        onPress={() => setShowFine((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showFine }}
        style={[styles.fineToggle, { borderTopColor: c.line }]}
      >
        <Icon name="check-circle-outline" size={20} color={c.ok} />
        <Txt variant="label" style={styles.grow}>
          Kunnossa ({fine.length})
        </Txt>
        <Icon name={showFine ? 'chevron-up' : 'chevron-down'} size={22} color={c.inkSoft} />
      </Pressable>

      {showFine
        ? categories.map((cat) => {
            const items = fine.filter((d) => d.category === cat.id);
            if (!items.length) return null;
            return (
              <Section key={cat.id} title={cat.name} quiet>
                {items.map((d) => (
                  <DeviceRow key={d.id} device={d} site={site} now={now} onPress={() => onSelect(d.id)} onError={onError} />
                ))}
              </Section>
            );
          })
        : null}
    </ScrollView>
  );
}

function Section({ title, quiet, children }: { title: string; quiet?: boolean; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.section}>
      <Txt variant={quiet ? 'caption' : 'label'} color={quiet ? c.muted : c.inkSoft} style={styles.sectionTitle}>
        {title}
      </Txt>
      {children}
    </View>
  );
}

function DeviceRow({
  device,
  site,
  now,
  onPress,
  onError,
}: {
  device: Device;
  site: Site;
  now: number;
  onPress(): void;
  onError(message: string): void;
}) {
  const c = useColors();
  const { setDeviceState } = useHome();
  const [busy, setBusy] = useState(false);
  const tone = deviceTone(device);
  const colors = toneColors(tone, c);
  // Listassa näytetään vain korjaava toiminto (sammuta, sulje, lukitse). Muut löytyvät laitteen tiedoista.
  const fix = device.needsAttention ? device.actions.find((a) => a.state === device.safeState) : undefined;
  const status = `${device.stateLabel.toLowerCase()}${device.needsAttention ? ` ${duration(device.changedAt, now)}` : ''}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${device.name}, ${status}`}
      style={({ pressed }) => [styles.row, { borderBottomColor: c.line }, pressed && { backgroundColor: c.line }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: tone === 'calm' ? 'transparent' : colors.bg, borderColor: colors.border }]}>
        <Icon name={deviceIcon(device)} size={22} color={colors.icon} />
      </View>
      <View style={styles.grow}>
        <Txt variant="label" numberOfLines={1}>
          {device.name}
        </Txt>
        <Txt variant="caption" color={tone === 'alert' ? c.signal : c.inkSoft} numberOfLines={1}>
          {roomName(site, device.roomId)}, {status}
        </Txt>
      </View>
      {fix ? (
        <PillButton
          label={fix.label}
          busy={busy}
          style={styles.rowAction}
          onPress={async () => {
            setBusy(true);
            try {
              await setDeviceState(device.id, fix.state);
            } catch (e) {
              onError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xl * 2 },
  section: { marginBottom: space.lg },
  sectionTitle: { marginBottom: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rowAction: { minHeight: 38, paddingHorizontal: space.md },
  grow: { flex: 1, minWidth: 0 },
  allLights: { alignSelf: 'flex-start', marginTop: space.md },
  fineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: space.sm,
  },
});
