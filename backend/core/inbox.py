"""Manager inbox: one message per owner/manager for each new event."""

import logging
import secrets
from datetime import datetime, timezone

from core.case_history import actor_of
from core.changes import record_change
from core.collections import AUTH_USERS, INBOX

logger = logging.getLogger(__name__)

# Messages are removed automatically by a MongoDB TTL index on `createdAt`.
INBOX_RETENTION_SECONDS = 90 * 24 * 60 * 60
INBOX_TARGETS = ("case", "toothOrder", "materialOrder", "route")
INBOX_SEVERITIES = ("info", "success", "warning")


async def ensure_inbox_indexes(database) -> None:
    collection = database[INBOX]
    await collection.create_index([("recipientId", 1), ("createdAt", -1)])
    await collection.create_index(
        "createdAt", expireAfterSeconds=INBOX_RETENTION_SECONDS
    )


async def notify_managers(
    database,
    *,
    kind: str,
    title: str,
    body: str,
    target: str,
    target_id: str,
    actor: dict | None,
    severity: str = "info",
) -> None:
    """Deliver a message to every active owner and manager except the actor.

    Best effort: the action that caused the event has already been saved, so a
    failure here is logged instead of failing the request.
    """
    if target not in INBOX_TARGETS:
        raise ValueError(f"Unknown inbox target '{target}'.")
    if severity not in INBOX_SEVERITIES:
        raise ValueError(f"Unknown inbox severity '{severity}'.")
    try:
        by_id, by = actor_of(actor)
        recipients = await database[AUTH_USERS].find(
            {"role": {"$in": ["owner", "manager"]}, "active": True, "_id": {"$ne": by_id}},
            {"_id": 1},
        ).to_list(None)
        if not recipients:
            return
        now = datetime.now(timezone.utc)
        await database[INBOX].insert_many(
            [
                {
                    "_id": f"M{secrets.token_hex(8).upper()}",
                    "recipientId": str(recipient["_id"]),
                    "kind": kind,
                    "severity": severity,
                    "title": title,
                    "body": body,
                    "target": target,
                    "targetId": target_id,
                    "by": by,
                    "byId": by_id,
                    "read": False,
                    "createdAt": now,
                }
                for recipient in recipients
            ]
        )
        await record_change(database, "inbox")
    except Exception:
        logger.exception("Could not deliver inbox message '%s'.", kind)


def inbox_message_to_api(doc: dict) -> dict:
    created = doc.get("createdAt")
    if isinstance(created, datetime):
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        created = (
            created.astimezone(timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z")
        )
    return {
        "id": str(doc["_id"]),
        "kind": doc.get("kind", ""),
        "severity": doc.get("severity", "info"),
        "title": doc.get("title", ""),
        "body": doc.get("body", ""),
        "target": doc.get("target", ""),
        "targetId": doc.get("targetId", ""),
        "by": doc.get("by", ""),
        "read": bool(doc.get("read")),
        "createdAt": created or "",
    }
