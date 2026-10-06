"""Assembles the full demo dataset and loads it into MongoDB once per day (dates stay relative to today)."""

import asyncio
import random
import time
from datetime import date, datetime
from zoneinfo import ZoneInfo

from core.collections import CLINIC_CONTACTS, PUBLIC_TRACKING, SEED_META, SETTINGS
from core.clinic_contacts import encrypt_contact_fields
from core.config import TIMEZONE
from core.database import db
from core.models import BaseDocument
from seed import workflow
from seed.calendar import next_production_day
from seed.logistics import build_routes, public_tracking
from seed.production import build_cases

SEED_VERSION = 2
PERSISTENT_COLLECTIONS = {
    "drivers",
    "clinics",
    CLINIC_CONTACTS,
    "routes",
    "stops",
    "route_plans",
    "tracking_emails",
    "notifications",
    PUBLIC_TRACKING,
    SETTINGS,
}
_lock = asyncio.Lock()
_seeded_marker = ""


def build_demo_data(today: date) -> dict[str, list[dict]]:
    rng = random.Random(today.isoformat())
    cases = build_cases(today, rng)
    routes = build_routes(cases.confirmed, next_production_day(today), rng)
    contacts = workflow.clinic_contacts()
    return {
        "users": workflow.users(),
        "drivers": workflow.drivers(),
        "clinics": workflow.clinics(),
        CLINIC_CONTACTS: [
            {
                "id": contact["id"],
                "encryptedData": encrypt_contact_fields(
                    contact["id"],
                    {
                        field: contact.get(field, "")
                        for field in ("email", "phone", "contact", "notes")
                    },
                ),
            }
            for contact in contacts
        ],
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
                if meta and name in PERSISTENT_COLLECTIONS:
                    continue
                await db[name].delete_many({})
                if docs:
                    await db[name].insert_many(
                        [BaseDocument(**d).to_mongo() for d in docs]
                    )
            await db[SEED_META].replace_one(
                {"_id": "demo"}, {"_id": "demo", "marker": marker}, upsert=True
            )
        legacy_contacts = (
            await db[CLINIC_CONTACTS]
            .find({"encryptedData": {"$exists": False}})
            .to_list(10_000)
        )
        for contact in legacy_contacts:
            fields = {
                field: contact.get(field, "")
                for field in ("email", "phone", "contact", "notes")
            }
            await db[CLINIC_CONTACTS].update_one(
                {"_id": contact["_id"], "encryptedData": {"$exists": False}},
                {
                    "$set": {
                        "encryptedData": encrypt_contact_fields(
                            str(contact["_id"]), fields
                        )
                    },
                    "$unset": {"email": "", "phone": "", "contact": "", "notes": ""},
                },
            )
        _seeded_marker = marker
