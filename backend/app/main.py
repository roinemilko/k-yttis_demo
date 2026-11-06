"""Kotipaneelin mock-API käyttäjätestausta varten.

/api/...            mobiilisovellus (noudattaa controlsEnabled-asetusta)
/api/facilitator/.. testinohjaaja (vaihtaa asetuksia ja laitteiden tiloja testin aikana)
"""

from pathlib import Path

from fastapi import APIRouter, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

from .data import load_seed
from .models import (
    Catalog,
    Config,
    ConfigPatch,
    DeviceOut,
    Event,
    FacilitatorOverview,
    FacilitatorStateChange,
    SiteOut,
    SiteSummary,
    Snapshot,
    StateChange,
    UsageEvent,
)
from .store import Store, StoreError

STATIC_DIR = Path(__file__).parent / "static"

store = Store(load_seed())

app = FastAPI(title="Kotipaneeli mock-API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(StoreError)
async def store_error_handler(_: Request, exc: StoreError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse("/ohjaus")


@app.get("/ohjaus", include_in_schema=False)
def facilitator_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "ohjaus.html")


@app.get("/api/health", tags=["yleinen"])
def health() -> dict:
    return {"ok": True}


# --- Mobiilisovellus ---

api = APIRouter(prefix="/api", tags=["sovellus"])


@api.get("/snapshot", response_model=Snapshot)
def snapshot(site_id: str | None = Query(None, alias="siteId")) -> Snapshot:
    return store.snapshot(site_id)


@api.get("/config", response_model=Config)
def get_config() -> Config:
    return store.config()


@api.get("/catalog", response_model=Catalog)
def get_catalog() -> Catalog:
    return store.catalog


@api.get("/sites", response_model=list[SiteSummary])
def list_sites() -> list[SiteSummary]:
    return store.site_summaries()


@api.get("/sites/{site_id}", response_model=SiteOut)
def get_site(site_id: str) -> SiteOut:
    return store.site(site_id)


@api.post("/devices/{device_id}/state", response_model=DeviceOut)
def set_device_state(device_id: str, body: StateChange) -> DeviceOut:
    return store.set_state_from_app(device_id, body.state)


@api.post("/sites/{site_id}/lights-off", response_model=SiteOut)
def lights_off(site_id: str) -> SiteOut:
    return store.lights_off(site_id)


@api.post("/events", status_code=204)
def log_usage(event: UsageEvent) -> None:
    store.log_usage(event.kind, event.message, event.device_id)


# --- Testinohjaaja ---

facilitator = APIRouter(prefix="/api/facilitator", tags=["testinohjaaja"])


@facilitator.get("", response_model=FacilitatorOverview)
def overview() -> FacilitatorOverview:
    return store.overview()


@facilitator.patch("/config", response_model=Config)
def update_config(patch: ConfigPatch) -> Config:
    return store.update_config(patch)


@facilitator.post("/devices/{device_id}/state", response_model=DeviceOut)
def force_device_state(device_id: str, body: FacilitatorStateChange) -> DeviceOut:
    return store.set_state_from_facilitator(device_id, body.state, body.minutes_ago)


@facilitator.post("/scenarios/{scenario_id}/apply", response_model=FacilitatorOverview)
def apply_scenario(scenario_id: str) -> FacilitatorOverview:
    return store.apply_scenario(scenario_id)


@facilitator.post("/reset", response_model=FacilitatorOverview)
def reset() -> FacilitatorOverview:
    store.reset()
    return store.overview()


@facilitator.get("/events", response_model=list[Event])
def events(after_id: int = Query(0, alias="afterId")) -> list[Event]:
    return store.events(after_id)


app.include_router(api)
app.include_router(facilitator)
