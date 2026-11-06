"""Tietomalli. Python-puolella snake_case, JSON-rajapinnassa camelCase."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

Severity = Literal["high", "medium", "low"]
ControlMode = Literal["none", "safe_only", "both"]
ViewMode = Literal["floorplan", "list"]
SiteStatus = Literal["ok", "info", "attention"]
EventSource = Literal["app", "ohjaus", "system"]


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# --- Lähtödata (shared/*.json) ---


class Category(ApiModel):
    id: str
    name: str


class DeviceType(ApiModel):
    name: str
    category: str
    risk: str
    severity: Severity
    states: dict[str, str]  # tila -> näytettävä nimi
    safe_state: str
    control: ControlMode  # none = ei ohjattavissa, safe_only = vain turvalliseen tilaan
    actions: dict[str, str]  # kohdetila -> napin teksti
    icon: str  # Material Design Icons -nimi


class Catalog(ApiModel):
    categories: list[Category]
    types: dict[str, DeviceType]


class Room(ApiModel):
    id: str
    code: str
    name: str
    x: float
    y: float
    w: float
    h: float


class Plan(ApiModel):
    width: float
    height: float
    rooms: list[Room]


class DeviceSeed(ApiModel):
    id: str
    type: str
    name: str
    room_id: str
    x: float
    y: float


class SiteSeed(ApiModel):
    id: str
    name: str
    plan: Plan
    devices: list[DeviceSeed]


class ScenarioDevice(ApiModel):
    state: str
    minutes_ago: int = 0


class Scenario(ApiModel):
    id: str
    name: str
    description: str
    site_id: str | None = None
    devices: dict[str, ScenarioDevice]


# --- Asetukset ---


class Config(ApiModel):
    controls_enabled: bool = False
    default_view: ViewMode = "floorplan"
    active_site_id: str = "koti"


class ConfigPatch(ApiModel):
    controls_enabled: bool | None = None
    default_view: ViewMode | None = None
    active_site_id: str | None = None


# --- Rajapinnan vastaukset ---


class Action(ApiModel):
    state: str
    label: str


class DeviceOut(ApiModel):
    id: str
    site_id: str
    room_id: str
    type: str
    name: str
    icon: str
    category: str
    severity: Severity
    x: float
    y: float
    state: str
    state_label: str
    safe_state: str
    needs_attention: bool
    changed_at: datetime
    actions: list[Action]


class SiteSummary(ApiModel):
    id: str
    name: str
    status: SiteStatus  # ok = kaikki kunnossa, info = vain valoja tms., attention = vaatii huomiota
    attention_count: int
    info_count: int
    device_count: int


class SiteOut(SiteSummary):
    plan: Plan
    devices: list[DeviceOut]
    revision: int


class Snapshot(ApiModel):
    """Kaikki mitä sovellus tarvitsee yhdellä kyselyllä (sovellus kyselee tätä muutaman sekunnin välein)."""

    config: Config
    sites: list[SiteSummary]
    site: SiteOut
    revision: int
    # Kun luku muuttuu, puhelin siirtyy ohjaajan valitsemaan kohteeseen tai aloitusnäkymään.
    site_focus: int
    view_focus: int


class StateChange(ApiModel):
    state: str


class FacilitatorStateChange(StateChange):
    minutes_ago: int = 0


class UsageEvent(ApiModel):
    """Sovelluksen käyttötapahtuma lokiin, esim. näkymän vaihto tai laitteen tietojen avaus."""

    kind: str
    message: str
    device_id: str | None = None


class Event(ApiModel):
    id: int
    at: datetime
    source: EventSource
    kind: str
    message: str
    device_id: str | None = None


class FacilitatorOverview(ApiModel):
    config: Config
    sites: list[SiteSummary]
    scenarios: list[Scenario]
    active_scenario_id: str | None
    revision: int
