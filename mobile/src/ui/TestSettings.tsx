import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { errorMessage, useHome } from '../data/HomeProvider';
import type { FacilitatorOverview, ViewMode } from '../data/types';
import { Icon, PillButton, Sheet, Txt } from './primitives';
import { Segmented } from './Segmented';
import { radius, space, useColors } from './theme';

/**
 * Piilotettu valikko testin järjestäjälle. Avautuu painamalla kohteen nimeä pitkään.
 * Avataan uudella key-arvolla joka kerta, joten lomakkeen tila alkaa nykyisistä asetuksista.
 */
export function TestSettings({ visible, onClose }: { visible: boolean; onClose(): void }) {
  const c = useColors();
  const home = useHome();
  const [overview, setOverview] = useState<FacilitatorOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState(home.source.mode === 'remote' ? home.source.url : 'http://192.168.1.20:8000');
  const [mode, setMode] = useState(home.source.mode);

  const { loadOverview } = home;
  const revision = home.snapshot?.revision;

  // Haetaan skenaariot uudelleen aina, kun tila muuttuu (myös ohjaajan selainsivulta).
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    loadOverview()
      .then((o) => {
        if (cancelled) return;
        setOverview(o);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [visible, loadOverview, revision]);

  async function act(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const config = overview?.config ?? home.snapshot?.config;

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Txt variant="title">Testiasetukset</Txt>
        <Txt variant="caption" color={c.inkSoft} style={styles.intro}>
          Näkyy vain testin järjestäjälle. Muutokset koskevat kaikkia samaan palvelimeen yhdistettyjä puhelimia.
        </Txt>

        <View style={[styles.row, { borderBottomColor: c.line }]}>
          <View style={styles.grow}>
            <Txt variant="label">Laitteiden ohjaus</Txt>
            <Txt variant="caption" color={c.inkSoft}>
              {config?.controlsEnabled ? 'Sammuta, sulje ja lukitse -painikkeet näkyvät' : 'Sovellus näyttää vain tilat'}
            </Txt>
          </View>
          <Switch
            value={config?.controlsEnabled ?? false}
            onValueChange={(v) => act(() => home.updateConfig({ controlsEnabled: v }))}
            trackColor={{ true: c.ink, false: c.lineStrong }}
            thumbColor={c.surface}
            {...{ activeThumbColor: c.surface }}
            accessibilityLabel="Laitteiden ohjaus"
          />
        </View>

        <Txt variant="label" style={styles.label}>
          Aloitusnäkymä
        </Txt>
        <Segmented<ViewMode>
          options={[
            { value: 'floorplan', label: 'Pohjapiirros' },
            { value: 'list', label: 'Lista' },
          ]}
          value={config?.defaultView ?? 'floorplan'}
          onChange={(v) => act(() => home.updateConfig({ defaultView: v }))}
        />

        <Txt variant="label" style={styles.label}>
          Testitilanne
        </Txt>
        {overview?.scenarios.map((s) => {
          const active = s.id === overview.activeScenarioId;
          return (
            <Pressable
              key={s.id}
              onPress={() => act(() => home.applyScenario(s.id))}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={({ pressed }) => [styles.row, { borderBottomColor: c.line }, pressed && { backgroundColor: c.line }]}
            >
              <Icon name={active ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={active ? c.ink : c.lineStrong} />
              <View style={styles.grow}>
                <Txt variant="label">{s.name}</Txt>
                <Txt variant="caption" color={c.inkSoft}>
                  {s.description}
                </Txt>
              </View>
            </Pressable>
          );
        })}
        {overview && !overview.activeScenarioId ? (
          <Txt variant="caption" color={c.inkSoft} style={styles.hint}>
            Tiloja on muutettu testitilanteen lataamisen jälkeen.
          </Txt>
        ) : null}

        <Txt variant="label" style={styles.label}>
          Tietolähde
        </Txt>
        <Segmented
          options={[
            { value: 'local', label: 'Puhelimessa' },
            { value: 'remote', label: 'Palvelin' },
          ]}
          value={mode}
          onChange={(v) => {
            setMode(v);
            if (v === 'local') home.setSource({ mode: 'local' });
          }}
        />
        {mode === 'remote' ? (
          <View style={styles.remote}>
            <Txt variant="caption" color={c.inkSoft}>
              Palvelimen osoite
            </Txt>
            <TextInput
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="http://192.168.1.20:8000"
              placeholderTextColor={c.muted}
              style={[styles.input, { borderColor: c.lineStrong, color: c.ink }]}
            />
            <PillButton label="Yhdistä" kind="primary" onPress={() => home.setSource({ mode: 'remote', url: url.trim() })} />
          </View>
        ) : null}
        <Txt variant="caption" color={home.connectionError ? c.signal : c.inkSoft} style={styles.hint}>
          {home.connectionError ??
            (home.source.mode === 'remote' ? `Yhdistetty: ${home.source.url}` : 'Data on puhelimessa, palvelinta ei tarvita.')}
        </Txt>

        {error ? (
          <Txt variant="body" color={c.signal} style={styles.hint}>
            {error}
          </Txt>
        ) : null}

        <View style={styles.footer}>
          <PillButton label="Nollaa testi" icon="restore" onPress={() => act(home.reset)} />
          <PillButton label="Valmis" kind="primary" onPress={onClose} style={styles.grow} />
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: space.xs, marginBottom: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  grow: { flex: 1 },
  label: { marginTop: space.xl, marginBottom: space.sm },
  hint: { marginTop: space.sm },
  remote: { marginTop: space.md, gap: space.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.pill,
    minHeight: 46,
    paddingHorizontal: space.lg,
    fontSize: 16,
  },
  footer: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
});
