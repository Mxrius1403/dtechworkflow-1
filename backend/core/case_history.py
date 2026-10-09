import secrets
from datetime import datetime, timezone

from core.collections import CASE_HISTORY


def utc_now_iso() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def actor_of(account: dict | None) -> tuple[str, str]:
    """Return (id, display name) of the acting account as plain text."""
    if not account:
        return "system", "System"
    return (
        str(account.get("_id", "")),
        str(account.get("name") or account.get("email") or "Unknown"),
    )


async def log_case_event(
    database,
    case: dict,
    action: str,
    account: dict | None,
    at: str | None = None,
) -> None:
    """Append an immutable audit entry.

    Everything is stored as plain text (case code, person name, ...) in its own
    collection so the record stays readable after the case or the person has
    been deleted or renamed.
    """
    by_id, by = actor_of(account)
    await database[CASE_HISTORY].insert_one(
        {
            "_id": f"H{secrets.token_hex(8).upper()}",
            "caseId": str(case["_id"]),
            "caseCode": str(case.get("code", "")),
            "action": action,
            "by": by,
            "byId": by_id,
            "at": at or utc_now_iso(),
        }
    )
