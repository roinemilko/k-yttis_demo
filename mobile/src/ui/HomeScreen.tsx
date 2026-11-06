import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHome } from '../data/HomeProvider';
import type { ViewMode } from '../data/types';
import { DeviceList } from './DeviceList';
import { DeviceSheet } from './DeviceSheet';
import { FloorPlan } from './FloorPlan';
import { siteStatusText } from './format';
import { Icon, PillButton, Txt } from './primitives';
import { Segmented } from './Segmented';
import { SitePicker } from './SitePicker';
import { TestSettings } from './TestSettings';
import { radius, space, useColors } from './theme';
import { useNow } from './useNow';

const LONG_PRESS_MS = 1200;

export function HomeScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { snapshot, connectionError, view, setView, track } = useHome();
  const now = useNow();
  // Laatikot pysyvät asennettuina sulkeutumisanimaation ajan; n vaihtaa key-arvon jokaisella avauksella.
  const [sheet, setSheet] = useState<{ deviceId: string; open: boolean; n: number } | null>(null);
  const [sitePicker, setSitePicker] = useState(false);
  const [settings, setSettings] = useState({ open: false, n: 0 });
  const openSettings = () => setSettings((s) => ({ open: true, n: s.n + 1 }));
  const closeSettings = () => setSettings((s) => ({ ...s, open: false }));
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const root = [styles.root, { backgroundColor: c.paper, paddingTop: insets.top + space.md, paddingBottom: insets.bottom }];

  if (!snapshot) {
    return (
      <View style={root}>
        {connectionError ? (
          <View style={styles.blocked}>
            <Icon name="wifi-off" size={36} color={c.inkSoft} />
            <Txt variant="title">Ei yhteyttä palvelimeen</Txt>
            <Txt variant="body" color={c.inkSoft}>
              {connectionError}. Tarkista osoite tai käytä puhelimen omaa dataa.
            </Txt>
            <PillButton label="Avaa testiasetukset" kind="primary" onPress={openSettings} />
          </View>
        ) : (
          <Skeleton />
        )}
        <TestSettings key={`settings-${settings.n}`} visible={settings.open} onClose={closeSettings} />
      </View>
    );
  }

  const { site } = snapshot;
  const status = siteStatusText(site, now);

  const openDevice = (deviceId: string) => {
    setSheet((s) => ({ deviceId, open: true, n: (s?.n ?? 0) + 1 }));
    const device = site.devices.find((d) => d.id === deviceId);
    if (device) track('open', `Avasi: ${device.name} (${view === 'list' ? 'lista' : 'pohjapiirros'})`, deviceId);
  };

  return (
    <View style={root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setSitePicker(true)}
          onLongPress={openSettings}
          delayLongPress={LONG_PRESS_MS}
          accessibilityRole="button"
          accessibilityLabel={`Kohde ${site.name}. Vaihda kohdetta.`}
          style={({ pressed }) => [styles.chip, { borderColor: c.lineStrong }, pressed && { backgroundColor: c.line }]}
        >
          <Txt variant="label">{site.name}</Txt>
          <Icon name="chevron-down" size={20} color={c.inkSoft} />
        </Pressable>
        {connectionError ? (
          <View style={[styles.offline, { backgroundColor: c.signalTint }]}>
            <Icon name="wifi-off" size={16} color={c.signal} />
            <Txt variant="caption" color={c.signal}>
              Ei yhteyttä, tiedot voivat olla vanhoja
            </Txt>
          </View>
        ) : null}
      </View>

      <View style={styles.hero} accessibilityRole="header" accessibilityLiveRegion="polite">
        <View style={styles.heroLine}>
          {status.tone === 'ok' ? <Icon name="check-circle" size={30} color={c.ok} /> : null}
          <Txt variant="hero" color={status.tone === 'attention' ? c.signal : c.ink} style={styles.grow}>
            {status.headline}
          </Txt>
        </View>
        {status.detail ? (
          <Txt variant="body" color={c.inkSoft} style={styles.detail}>
            {status.detail}
          </Txt>
        ) : null}
      </View>

      <View style={styles.switcher}>
        <Segmented<ViewMode>
          options={[
            { value: 'floorplan', label: 'Pohjapiirros', icon: 'floor-plan' },
            { value: 'list', label: 'Lista', icon: 'format-list-bulleted' },
          ]}
          value={view}
          onChange={(v) => {
            setView(v);
            track('view', `Näkymä: ${v === 'list' ? 'Lista' : 'Pohjapiirros'}`);
          }}
        />
      </View>

      <View style={styles.body}>
        {view === 'floorplan' ? (
          <FloorPlan site={site} onSelect={openDevice} />
        ) : (
          <DeviceList key={site.id} site={site} now={now} onSelect={openDevice} onError={setNotice} />
        )}
      </View>

      {notice ? (
        <View style={[styles.notice, { backgroundColor: c.ink, bottom: insets.bottom + space.lg }]} accessibilityLiveRegion="assertive">
          <Txt variant="body" color={c.paper}>
            {notice}
          </Txt>
        </View>
      ) : null}

      {sheet ? (
        <DeviceSheet
          key={`device-${sheet.n}`}
          deviceId={sheet.deviceId}
          visible={sheet.open}
          now={now}
          onClose={() => setSheet((s) => s && { ...s, open: false })}
        />
      ) : null}
      <SitePicker visible={sitePicker} onClose={() => setSitePicker(false)} />
      <TestSettings key={`settings-${settings.n}`} visible={settings.open} onClose={closeSettings} />
    </View>
  );
}

function Skeleton() {
  const c = useColors();
  const bar = (width: number | `${number}%`, height: number) => (
    <View style={{ width, height, borderRadius: radius.pill, backgroundColor: c.line, marginBottom: space.md }} />
  );
  return (
    <View accessibilityLabel="Ladataan" style={styles.skeleton}>
      {bar(96, 40)}
      {bar('80%', 30)}
      {bar('60%', 18)}
      {bar('100%', 44)}
      <View style={{ flex: 1, borderWidth: 2, borderColor: c.line, marginTop: space.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.gutter },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingLeft: space.lg,
    paddingRight: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  hero: { marginTop: space.xl },
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  detail: { marginTop: space.sm, maxWidth: 520 },
  switcher: { marginTop: space.xl, marginBottom: space.lg },
  body: { flex: 1 },
  grow: { flex: 1 },
  notice: { position: 'absolute', left: space.gutter, right: space.gutter, borderRadius: radius.box, padding: space.lg },
  blocked: { flex: 1, justifyContent: 'center', gap: space.md },
  skeleton: { flex: 1, paddingBottom: space.xl },
});
