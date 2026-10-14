"""Change counters that tell open screens what to reload.

Every successful write bumps the counter of the area it touched. Screens poll
GET /api/changes and reload an area only when its counter has moved.
"""

import logging

from core.collections import CHANGES

logger = logging.getLogger(__name__)

CHANGE_AREAS = ("data", "cases", "inbox", "products", "serviceTypes")
_DOCUMENT_ID = "app"
# Keeping a session alive changes nothing that other screens show.
_SESSION_PATHS = frozenset(
    {"/api/auth/login", "/api/auth/logout", "/api/auth/refresh"}
)
# Writes elsewhere may touch any collection in /api/data, so they count as "data".
_AREA_BY_PREFIX = (
    ("/api/receiving", "cases"),
    ("/api/inbox", "inbox"),
    ("/api/products", "products"),
    ("/api/service-types", "serviceTypes"),
)


def area_of_write(path: str) -> str | None:
    """The area a state-changing request to `path` changes, or None."""
    if not path.startswith("/api/") or path in _SESSION_PATHS:
        return None
    return next(
        (area for prefix, area in _AREA_BY_PREFIX if path.startswith(prefix)),
        "data",
    )


async def record_change(database, area: str) -> None:
    """Best effort: the change is already saved, so a failure is only logged."""
    try:
        await database[CHANGES].update_one(
            {"_id": _DOCUMENT_ID}, {"$inc": {area: 1}}, upsert=True
        )
    except Exception:
        logger.exception("Could not record a change to '%s'.", area)


async def read_changes(database) -> dict[str, int]:
    document = await database[CHANGES].find_one({"_id": _DOCUMENT_ID}) or {}
    return {area: int(document.get(area, 0)) for area in CHANGE_AREAS}
