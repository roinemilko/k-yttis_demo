import json
import shutil

import pytest

from app.data import SHARED_DIR, load_seed


def test_shared_seed_is_valid():
    seed = load_seed()
    assert {s.id for s in seed.sites} == {"koti", "mokki"}


def test_devices_sit_inside_their_room():
    for site in load_seed().sites:
        rooms = {r.id: r for r in site.plan.rooms}
        for d in site.devices:
            room = rooms[d.room_id]
            assert room.x <= d.x <= room.x + room.w, d.id
            assert room.y <= d.y <= room.y + room.h, d.id


def test_typo_in_seed_gives_readable_error(tmp_path):
    shutil.copytree(SHARED_DIR, tmp_path, dirs_exist_ok=True)
    sites = json.loads((tmp_path / "sites.json").read_text(encoding="utf-8"))
    sites["sites"][0]["devices"][0]["roomId"] = "keittio"
    (tmp_path / "sites.json").write_text(json.dumps(sites), encoding="utf-8")

    with pytest.raises(ValueError, match="huonetta keittio ei ole"):
        load_seed(tmp_path)
