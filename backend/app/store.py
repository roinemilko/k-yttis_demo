"""Muistissa pidettävä kodin tila. Uudelleenkäynnistys tai nollaus palauttaa aloitusskenaarion."""

import threading
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from .data import Seed
from .models import (
    Action,
    Catalog,
    Config,
    ConfigPatch,
    DeviceOut,
    DeviceSeed,
    DeviceType,
    Event,
    EventSource,
    FacilitatorOverview,
    SiteOut,
    SiteSeed,
    SiteSummary,
    Snapshot,
)

# Laitteet, joita skenaario ei mainitse, ovat olleet turvallisessa tilassa näin kauan.
IDLE_AGE = timedelta(hours=3)


class StoreError(Exception):
    status_code = 400

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class NotFound(StoreError):
    status_code = 404


class ControlsDisabled(StoreError):
    status_code = 403


class NotAllowed(StoreError):
    status_code = 409


class InvalidState(StoreError):
    status_code = 422


@dataclass
class DeviceState:
    state: str
    changed_at: datetime


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Store:
    def __init__(self, seed: Seed):
        self._seed = seed
        self._lock = threading.RLock()
        self._sites: dict[str, SiteSeed] = {s.id: s for s in seed.sites}
        self._devices: dict[str, tuple[str, DeviceSeed]] = {
            d.id: (s.id, d) for s in seed.sites for d in s.devices
        }
        self._scenarios = {sc.id: sc for sc in seed.scenarios}
        # Nämä laskurit jatkuvat nollauksen yli, jotta selainpaneeli ja puhelimet huomaavat muutoksen.
        self._next_event_id = 1
        self._site_focus = 0  # kasvaa, kun ohjaaja vaihtaa puhelimen kohdetta
        self._view_focus = 0  # kasvaa, kun ohjaaja vaihtaa aloitusnäkymää
        self.reset()

    # --- Luku ---

    @property
    def catalog(self) -> Catalog:
        return self._seed.catalog

    def config(self) -> Config:
        with self._lock:
            return self._config.model_copy()

    def site_summaries(self) -> list[SiteSummary]:
        with self._lock:
            return [self._summary(s) for s in self._seed.sites]

    def site(self, site_id: str) -> SiteOut:
        with self._lock:
            site = self._get_site(site_id)
            return SiteOut(
                **self._summary(site).model_dump(),
                plan=site.plan,
                devices=[self._device_out(d.id) for d in site.devices],
                revision=self._revision,
            )

    def snapshot(self, site_id: str | None = None) -> Snapshot:
        with self._lock:
            return Snapshot(
                config=self.config(),
                sites=self.site_summaries(),
                site=self.site(site_id or self._config.active_site_id),
                revision=self._revision,
                site_focus=self._site_focus,
                view_focus=self._view_focus,
            )

    def events(self, after_id: int = 0) -> list[Event]:
        with self._lock:
            return [e for e in self._events if e.id > after_id]

    def overview(self) -> FacilitatorOverview:
        with self._lock:
            return FacilitatorOverview(
                config=self.config(),
                sites=self.site_summaries(),
                scenarios=list(self._scenarios.values()),
                active_scenario_id=self._active_scenario_id,
                revision=self._revision,
            )

    # --- Sovelluksen toiminnot (noudattavat ohjausasetusta) ---

    def set_state_from_app(self, device_id: str, state: str) -> DeviceOut:
        with self._lock:
            _, device = self._get_device(device_id)
            device_type = self._type(device)
            if state not in device_type.states:
                raise InvalidState(f"Laitteella {device.name} ei ole tilaa '{state}'")
            if not self._config.controls_enabled:
                raise ControlsDisabled("Laitteiden ohjaus ei ole käytössä")
            current = self._state[device_id].state
            if state != current:
                allowed = {a.state for a in self._allowed_actions(device_type, current)}
                if state not in allowed:
                    raise NotAllowed(
                        f"{device.name}: tilaan '{device_type.states[state]}' ei voi vaihtaa sovelluksesta"
                    )
                self._set(device_id, state, source="app")
            return self._device_out(device_id)

    def lights_off(self, site_id: str) -> SiteOut:
        with self._lock:
            site = self._get_site(site_id)
            if not self._config.controls_enabled:
                raise ControlsDisabled("Laitteiden ohjaus ei ole käytössä")
            for device in site.devices:
                device_type = self._type(device)
                if device_type.category == "lights" and self._state[device.id].state != device_type.safe_state:
                    self._set(device.id, device_type.safe_state, source="app")
            return self.site(site_id)

    def log_usage(self, kind: str, message: str, device_id: str | None = None) -> None:
        with self._lock:
            self._log("app", kind, message, device_id)

    # --- Testinohjaajan toiminnot (ohittavat ohjausasetuksen) ---

    def update_config(self, patch: ConfigPatch) -> Config:
        with self._lock:
            changes = patch.model_dump(exclude_none=True)
            if "active_site_id" in changes:
                self._get_site(changes["active_site_id"])
            self._config = self._config.model_copy(update=changes)
            self._site_focus += "active_site_id" in changes
            self._view_focus += "default_view" in changes
            self._revision += 1
            self._log("ohjaus", "config", self._describe_config(changes))
            return self.config()

    def set_state_from_facilitator(self, device_id: str, state: str, minutes_ago: int = 0) -> DeviceOut:
        with self._lock:
            _, device = self._get_device(device_id)
            if state not in self._type(device).states:
                raise InvalidState(f"Laitteella {device.name} ei ole tilaa '{state}'")
            self._set(device_id, state, source="ohjaus", minutes_ago=minutes_ago)
            return self._device_out(device_id)

    def apply_scenario(self, scenario_id: str) -> FacilitatorOverview:
        with self._lock:
            if scenario_id not in self._scenarios:
                raise NotFound(f"Skenaariota '{scenario_id}' ei ole")
            self._apply_scenario(scenario_id)
            self._log("ohjaus", "scenario", f"Skenaario: {self._scenarios[scenario_id].name}")
            return self.overview()

    def reset(self) -> None:
        with self._lock:
            self._config = Config()
            self._events: deque[Event] = deque(maxlen=500)
            self._revision = 0
            self._state: dict[str, DeviceState] = {}
            self._active_scenario_id: str | None = None
            self._apply_scenario(self._seed.initial_scenario)
            self._site_focus += 1
            self._view_focus += 1
            self._log("system", "reset", "Tila nollattu")

    # --- Sisäiset ---

    def _apply_scenario(self, scenario_id: str) -> None:
        scenario = self._scenarios[scenario_id]
        now = _now()
        for device_id, (_, device) in self._devices.items():
            self._state[device_id] = DeviceState(self._type(device).safe_state, now - IDLE_AGE)
        for device_id, change in scenario.devices.items():
            self._state[device_id] = DeviceState(change.state, now - timedelta(minutes=change.minutes_ago))
        if scenario.site_id:
            self._config = self._config.model_copy(update={"active_site_id": scenario.site_id})
            self._site_focus += 1
        self._active_scenario_id = scenario_id
        self._revision += 1

    def _set(self, device_id: str, state: str, source: EventSource, minutes_ago: int = 0) -> None:
        _, device = self._devices[device_id]
        self._state[device_id] = DeviceState(state, _now() - timedelta(minutes=minutes_ago))
        self._active_scenario_id = None
        self._revision += 1
        self._log(source, "state", f"{device.name}: {self._type(device).states[state]}", device_id)

    def _describe_config(self, changes: dict) -> str:
        parts = []
        if "controls_enabled" in changes:
            parts.append("Laitteiden ohjaus " + ("päällä" if changes["controls_enabled"] else "pois"))
        if "default_view" in changes:
            parts.append("Aloitusnäkymä: " + ("Lista" if changes["default_view"] == "list" else "Pohjapiirros"))
        if "active_site_id" in changes:
            parts.append("Kohde: " + self._sites[changes["active_site_id"]].name)
        return ", ".join(parts) or "Asetukset ennallaan"

    def _log(self, source: EventSource, kind: str, message: str, device_id: str | None = None) -> None:
        self._events.append(
            Event(id=self._next_event_id, at=_now(), source=source, kind=kind, message=message, device_id=device_id)
        )
        self._next_event_id += 1

    def _get_site(self, site_id: str) -> SiteSeed:
        if site_id not in self._sites:
            raise NotFound(f"Kohdetta '{site_id}' ei ole")
        return self._sites[site_id]

    def _get_device(self, device_id: str) -> tuple[str, DeviceSeed]:
        if device_id not in self._devices:
            raise NotFound(f"Laitetta '{device_id}' ei ole")
        return self._devices[device_id]

    def _type(self, device: DeviceSeed) -> DeviceType:
        return self._seed.catalog.types[device.type]

    def _allowed_actions(self, device_type: DeviceType, state: str) -> list[Action]:
        if not self._config.controls_enabled or device_type.control == "none":
            return []
        if device_type.control == "safe_only":
            targets = [device_type.safe_state] if state != device_type.safe_state else []
        else:
            targets = [s for s in device_type.states if s != state]
        return [Action(state=s, label=device_type.actions[s]) for s in targets if s in device_type.actions]

    def _device_out(self, device_id: str) -> DeviceOut:
        site_id, device = self._devices[device_id]
        device_type = self._type(device)
        current = self._state[device_id]
        return DeviceOut(
            id=device.id,
            site_id=site_id,
            room_id=device.room_id,
            type=device.type,
            name=device.name,
            icon=device_type.icon,
            category=device_type.category,
            severity=device_type.severity,
            x=device.x,
            y=device.y,
            state=current.state,
            state_label=device_type.states[current.state],
            safe_state=device_type.safe_state,
            needs_attention=current.state != device_type.safe_state,
            changed_at=current.changed_at,
            actions=self._allowed_actions(device_type, current.state),
        )

    def _summary(self, site: SiteSeed) -> SiteSummary:
        devices = [self._device_out(d.id) for d in site.devices]
        attention = sum(1 for d in devices if d.needs_attention and d.severity != "low")
        info = sum(1 for d in devices if d.needs_attention and d.severity == "low")
        return SiteSummary(
            id=site.id,
            name=site.name,
            status="attention" if attention else "info" if info else "ok",
            attention_count=attention,
            info_count=info,
            device_count=len(devices),
        )
