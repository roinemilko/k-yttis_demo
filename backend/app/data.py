"""Lataa ja tarkistaa jaetun lähtödatan (shared/), jota myös mobiilisovellus käyttää."""

import json
from dataclasses import dataclass
from pathlib import Path

from .models import Catalog, Scenario, SiteSeed

SHARED_DIR = Path(__file__).resolve().parents[2] / "shared"


@dataclass(frozen=True)
class Seed:
    catalog: Catalog
    sites: list[SiteSeed]
    scenarios: list[Scenario]
    initial_scenario: str


def load_seed(shared_dir: Path = SHARED_DIR) -> Seed:
    def read(name: str) -> dict:
        return json.loads((shared_dir / name).read_text(encoding="utf-8"))

    scenarios_raw = read("scenarios.json")
    seed = Seed(
        catalog=Catalog.model_validate(read("device-types.json")),
        sites=[SiteSeed.model_validate(s) for s in read("sites.json")["sites"]],
        scenarios=[Scenario.model_validate(s) for s in scenarios_raw["scenarios"]],
        initial_scenario=scenarios_raw["initialScenario"],
    )
    validate_seed(seed)
    return seed


def validate_seed(seed: Seed) -> None:
    """Kaatuu selkeään virheeseen, jos JSON-tiedostoissa on kirjoitusvirhe."""
    errors: list[str] = []
    category_ids = {c.id for c in seed.catalog.categories}

    for type_id, t in seed.catalog.types.items():
        if t.category not in category_ids:
            errors.append(f"Laitetyypin {type_id} kategoria {t.category} puuttuu")
        if t.safe_state not in t.states:
            errors.append(f"Laitetyypin {type_id} turvallinen tila {t.safe_state} ei ole tiloissa")
        for target in t.actions:
            if target not in t.states:
                errors.append(f"Laitetyypin {type_id} toiminto vie tuntemattomaan tilaan {target}")

    device_types: dict[str, str] = {}
    site_ids = {s.id for s in seed.sites}
    for site in seed.sites:
        room_ids = {r.id for r in site.plan.rooms}
        for d in site.devices:
            if d.id in device_types:
                errors.append(f"Laite-id {d.id} on käytössä kahdesti")
            device_types[d.id] = d.type
            if d.type not in seed.catalog.types:
                errors.append(f"Laitteen {d.id} tyyppiä {d.type} ei ole")
            if d.room_id not in room_ids:
                errors.append(f"Laitteen {d.id} huonetta {d.room_id} ei ole kohteessa {site.id}")

    scenario_ids = {s.id for s in seed.scenarios}
    if seed.initial_scenario not in scenario_ids:
        errors.append(f"Aloitusskenaariota {seed.initial_scenario} ei ole")
    for sc in seed.scenarios:
        if sc.site_id is not None and sc.site_id not in site_ids:
            errors.append(f"Skenaarion {sc.id} kohdetta {sc.site_id} ei ole")
        for device_id, change in sc.devices.items():
            type_id = device_types.get(device_id)
            if type_id is None:
                errors.append(f"Skenaarion {sc.id} laitetta {device_id} ei ole")
            elif type_id in seed.catalog.types and change.state not in seed.catalog.types[type_id].states:
                errors.append(f"Skenaarion {sc.id} laitteella {device_id} ei ole tilaa {change.state}")

    if errors:
        raise ValueError("Virheellinen lähtödata:\n- " + "\n- ".join(errors))
