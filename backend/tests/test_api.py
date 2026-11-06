import pytest
from fastapi.testclient import TestClient

from app.main import app, store

client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_state():
    store.reset()


def enable_controls(enabled: bool = True) -> None:
    r = client.patch("/api/facilitator/config", json={"controlsEnabled": enabled})
    assert r.status_code == 200


def device(site: dict, device_id: str) -> dict:
    return next(d for d in site["devices"] if d["id"] == device_id)


def test_snapshot_uses_active_site_and_camel_case():
    snap = client.get("/api/snapshot").json()
    assert snap["config"] == {"controlsEnabled": False, "defaultView": "floorplan", "activeSiteId": "koti"}
    assert snap["site"]["id"] == "koti"
    assert {s["id"] for s in snap["sites"]} == {"koti", "mokki"}
    assert snap["site"]["plan"]["rooms"][0]["code"] == "AT"
    assert "roomId" in snap["site"]["devices"][0]


def test_initial_scenario_needs_attention():
    site = client.get("/api/sites/koti").json()
    assert site["status"] == "attention"
    assert site["attentionCount"] == 2  # kahvinkeitin + pesukoneen hana
    assert site["infoCount"] == 2  # kaksi valoa
    assert device(site, "koti-pesukone-hana")["stateLabel"] == "Auki"


def test_controls_disabled_hides_actions_and_blocks_changes():
    site = client.get("/api/sites/koti").json()
    assert all(d["actions"] == [] for d in site["devices"])
    r = client.post("/api/devices/koti-kahvinkeitin/state", json={"state": "off"})
    assert r.status_code == 403
    assert client.post("/api/sites/koti/lights-off").status_code == 403


def test_safe_only_device_can_only_be_turned_off():
    enable_controls()
    coffee = device(client.get("/api/sites/koti").json(), "koti-kahvinkeitin")
    assert coffee["actions"] == [{"state": "off", "label": "Sammuta"}]

    r = client.post("/api/devices/koti-kahvinkeitin/state", json={"state": "off"})
    assert r.status_code == 200
    assert r.json()["needsAttention"] is False
    assert r.json()["actions"] == []

    r = client.post("/api/devices/koti-kahvinkeitin/state", json={"state": "on"})
    assert r.status_code == 409


def test_repeated_change_to_same_state_is_ok():
    enable_controls()
    for _ in range(2):
        assert client.post("/api/devices/koti-pesukone-hana/state", json={"state": "closed"}).status_code == 200


def test_fridge_door_is_never_controllable():
    enable_controls()
    client.post("/api/facilitator/devices/koti-jaakaappi/state", json={"state": "open"})
    fridge = device(client.get("/api/sites/koti").json(), "koti-jaakaappi")
    assert fridge["needsAttention"] is True
    assert fridge["actions"] == []
    assert client.post("/api/devices/koti-jaakaappi/state", json={"state": "closed"}).status_code == 409


def test_lights_can_be_switched_both_ways_and_all_off():
    enable_controls()
    light = device(client.get("/api/sites/koti").json(), "koti-valo-oh")
    assert light["actions"] == [{"state": "on", "label": "Sytytä"}]

    site = client.post("/api/sites/koti/lights-off").json()
    assert site["infoCount"] == 0
    assert site["attentionCount"] == 2


def test_invalid_state_and_unknown_ids():
    enable_controls()
    assert client.post("/api/devices/koti-liesi/state", json={"state": "auki"}).status_code == 422
    assert client.post("/api/devices/ei-ole/state", json={"state": "off"}).status_code == 404
    assert client.get("/api/sites/ei-ole").status_code == 404
    assert client.patch("/api/facilitator/config", json={"activeSiteId": "ei-ole"}).status_code == 404


def test_scenario_switches_site_and_states():
    overview = client.post("/api/facilitator/scenarios/mokilta-lahto/apply").json()
    assert overview["config"]["activeSiteId"] == "mokki"
    assert overview["activeScenarioId"] == "mokilta-lahto"
    statuses = {s["id"]: s["status"] for s in overview["sites"]}
    assert statuses == {"koti": "ok", "mokki": "attention"}

    client.post("/api/facilitator/scenarios/vain-valot/apply")
    koti = client.get("/api/sites/koti").json()
    assert koti["status"] == "info"


def test_facilitator_change_sets_age_and_clears_scenario():
    client.post("/api/facilitator/devices/koti-liesi/state", json={"state": "on", "minutesAgo": 40})
    overview = client.get("/api/facilitator").json()
    assert overview["activeScenarioId"] is None
    assert device(client.get("/api/sites/koti").json(), "koti-liesi")["needsAttention"] is True


def test_events_record_source_and_support_polling():
    enable_controls()
    client.post("/api/devices/koti-kahvinkeitin/state", json={"state": "off"})
    events = client.get("/api/facilitator/events").json()
    assert [e["source"] for e in events] == ["system", "ohjaus", "app"]
    assert events[1]["message"] == "Laitteiden ohjaus päällä"
    assert events[-1]["message"] == "Kahvinkeitin: Pois päältä"

    newer = client.get("/api/facilitator/events", params={"afterId": events[-2]["id"]}).json()
    assert [e["id"] for e in newer] == [events[-1]["id"]]


def test_revision_grows_on_every_change():
    before = client.get("/api/snapshot").json()["revision"]
    client.post("/api/facilitator/devices/koti-liesi/state", json={"state": "on"})
    assert client.get("/api/snapshot").json()["revision"] > before


def test_usage_events_are_logged_as_app():
    r = client.post("/api/events", json={"kind": "open", "message": "Avasi: Liesi", "deviceId": "koti-liesi"})
    assert r.status_code == 204
    last = client.get("/api/facilitator/events").json()[-1]
    assert (last["source"], last["message"], last["deviceId"]) == ("app", "Avasi: Liesi", "koti-liesi")


def test_event_ids_keep_growing_across_reset():
    before = client.get("/api/facilitator/events").json()[-1]["id"]
    client.post("/api/facilitator/reset")
    after = client.get("/api/facilitator/events", params={"afterId": before}).json()
    assert [e["message"] for e in after] == ["Tila nollattu"]


def test_facilitator_page_is_served():
    r = client.get("/ohjaus")
    assert r.status_code == 200
    assert "Testinohjaus" in r.text


def test_focus_counters_tell_phone_to_follow_facilitator():
    first = client.get("/api/snapshot").json()
    client.patch("/api/facilitator/config", json={"controlsEnabled": True})
    same = client.get("/api/snapshot").json()
    assert (same["siteFocus"], same["viewFocus"]) == (first["siteFocus"], first["viewFocus"])

    # Koti-skenaario siirtää puhelimen Kotiin, vaikka kohde oli jo valmiiksi koti.
    client.post("/api/facilitator/scenarios/hella-unohtui/apply")
    after = client.get("/api/snapshot").json()
    assert after["siteFocus"] > first["siteFocus"]
    assert after["viewFocus"] == first["viewFocus"]

    client.patch("/api/facilitator/config", json={"defaultView": "list"})
    assert client.get("/api/snapshot").json()["viewFocus"] > first["viewFocus"]
