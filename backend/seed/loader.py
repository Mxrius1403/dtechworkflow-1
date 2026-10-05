"""Assembles the full demo dataset and loads it into MongoDB once per day (dates stay relative to today)."""
import asyncio
import random
import time
from datetime import date, datetime
from zoneinfo import ZoneInfo

from core.collections import CLINIC_CONTACTS, PUBLIC_TRACKING, SEED_META, SETTINGS
from core.config import TIMEZONE
from core.database import db
from core.models import BaseDocument
from seed import workflow
from seed.calendar import next_production_day
from seed.logistics import build_routes, public_tracking
from seed.production import build_cases

SEED_VERSION = 1
_lock = asyncio.Lock()
_seeded_marker = ""


def build_demo_data(today: date) -> dict[str, list[dict]]:
    rng = random.Random(today.isoformat())
    cases = build_cases(today, rng)
    routes = build_routes(cases.confirmed, next_production_day(today), rng)
    return {
        "users": workflow.users(),
        "drivers": workflow.drivers(),
        "clinics": workflow.clinics(),
        CLINIC_CONTACTS: workflow.clinic_contacts(),
        "cases": cases.items,
        "routes": routes.routes,
        "stops": routes.stops,
        "route_plans": routes.plans,
        "tracking_emails": routes.emails,
        "notifications": routes.notifications,
        PUBLIC_TRACKING: public_tracking(routes, int(time.time() * 1000)),
        "tooth_orders": workflow.tooth_orders(today),
        "material_orders": workflow.material_orders(today),
        "saved_reports": workflow.saved_reports(today),
        "leave_requests": workflow.leave_requests(today),
        "other_work": workflow.other_work(today),
        SETTINGS: [workflow.settings(today)],
    }


async def ensure_demo_data() -> None:
    global _seeded_marker
    today = datetime.now(ZoneInfo(TIMEZONE)).date()
    marker = f"v{SEED_VERSION}:{today.isoformat()}"
    if _seeded_marker == marker:
        return
    async with _lock:
        meta = await db[SEED_META].find_one({"_id": "demo"})
        if not meta or meta.get("marker") != marker:
            for name, docs in build_demo_data(today).items():
                await db[name].delete_many({})
                if docs:
                    await db[name].insert_many([BaseDocument(**d).to_mongo() for d in docs])
            await db[SEED_META].replace_one({"_id": "demo"}, {"_id": "demo", "marker": marker}, upsert=True)
        _seeded_marker = marker
