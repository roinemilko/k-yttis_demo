import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage, useHome } from '../data/HomeProvider';
import type { Action } from '../data/types';
import { deviceIcon, deviceTone, toneColors } from './deviceVisual';
import { clockTime, duration, roomName } from './format';
import { Icon, PillButton, Sheet, Txt } from './primitives';
import { radius, space, useColors } from './theme';

/** Avataan uudella key-arvolla joka kerta, joten virhe- ja vahvistustila alkavat tyhjästä. */
export function DeviceSheet({
  deviceId,
  visible,
  now,
  onClose,
}: {
  deviceId: string;
  visible: boolean;
  now: number;
  onClose(): void;
}) {
  const c = useColors();
  const { snapshot, setDeviceState } = useHome();
  const device = snapshot?.site.devices.find((d) => d.id === deviceId);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Action | null>(null);

  // Laite voi kadota, jos ohjaaja vaihtaa kohdetta laatikon ollessa auki.
  if (!device || !snapshot) return null;

  const tone = deviceTone(device);
  const colors = toneColors(tone, c);
  const controlsEnabled = snapshot.config.controlsEnabled;

  async function run(action: Action) {
    setBusy(action.state);
    setError(null);
    try {
      await setDeviceState(deviceId, action.state);
      setConfirming(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  // Ovien avaaminen etänä vaatii vahvistuksen.
  const needsConfirm = (a: Action) => device.category === 'doors' && a.state !== device.safeState;

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: tone === 'calm' ? 'transparent' : colors.bg, borderColor: colors.border }]}>
          <Icon name={deviceIcon(device)} size={28} color={colors.icon} />
        </View>
        <View style={styles.grow}>
          <Txt variant="title">{device.name}</Txt>
          <Txt variant="caption" color={c.inkSoft}>
            {roomName(snapshot.site, device.roomId)}
          </Txt>
        </View>
      </View>

      <Txt variant="hero" color={tone === 'calm' ? c.ink : colors.text} style={styles.state}>
        {device.stateLabel}
      </Txt>
      <Txt variant="body" color={c.inkSoft}>
        Muuttui {clockTime(device.changedAt, now)}, {duration(device.changedAt, now)} sitten
      </Txt>

      {confirming ? (
        <View style={[styles.confirm, { borderColor: c.signal, backgroundColor: c.signalTint }]}>
          <Txt variant="body">
            {device.name} jää lukitsematta. Haluatko varmasti avata sen etänä?
          </Txt>
          <View style={styles.actions}>
            <PillButton label={confirming.label} kind="danger" busy={busy === confirming.state} onPress={() => run(confirming)} />
            <PillButton label="Peru" onPress={() => setConfirming(null)} />
          </View>
        </View>
      ) : controlsEnabled && device.actions.length > 0 ? (
        <View style={styles.actions}>
          {device.actions.map((a) => (
            <PillButton
              key={a.state}
              label={a.label}
              kind={a.state === device.safeState ? 'primary' : 'secondary'}
              busy={busy === a.state}
              style={styles.grow}
              onPress={() => (needsConfirm(a) ? setConfirming(a) : run(a))}
            />
          ))}
        </View>
      ) : controlsEnabled && device.needsAttention ? (
        <Txt variant="body" color={c.inkSoft} style={styles.note}>
          Tätä laitetta ei voi ohjata sovelluksesta. Tarkista se paikan päällä.
        </Txt>
      ) : null}

      {error ? (
        <Txt variant="body" color={c.signal} style={styles.note}>
          {error}
        </Txt>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  state: { marginTop: space.xl },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
  confirm: { marginTop: space.xl, borderWidth: 1, borderRadius: radius.box, padding: space.lg },
  note: { marginTop: space.lg },
});
