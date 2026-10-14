"""Service types that Managers set up for each department.

"None" is never stored: it is always selectable, even before a department has
any service types.
"""

from core.collections import SERVICE_TYPES
from core.workflow_constants import DEPARTMENT_LABELS, NO_SERVICE_TYPE

SERVICE_TYPE_NAME_LIMIT = 60


def name_key(name: str) -> str:
    return " ".join(name.split()).casefold()


async def ensure_service_type_indexes(database) -> None:
    await database[SERVICE_TYPES].create_index(
        [("department", 1), ("nameKey", 1)], unique=True
    )


async def read_service_types(database, department: str | None = None) -> list[dict]:
    query = {"department": department} if department else {}
    docs = await database[SERVICE_TYPES].find(query).to_list(None)
    docs.sort(key=lambda doc: (doc.get("createdAt", ""), str(doc["_id"])))
    return [
        {"id": str(doc["_id"]), "department": doc["department"], "name": doc["name"]}
        for doc in docs
    ]


def check_service_selection(selected: list[str]) -> list[str]:
    """Shape rules that do not depend on what Managers have set up."""
    names = [" ".join(str(item).split()) for item in selected]
    keys = [name_key(name) for name in names]
    if (
        not names
        or any(not name for name in names)
        or len(set(keys)) != len(keys)
        or (name_key(NO_SERVICE_TYPE) in keys and len(keys) > 1)
    ):
        raise ValueError("Select valid service types.")
    return names


def match_service_types(
    configured: list[str], department: str, selected: list[str]
) -> list[str]:
    """Return the selection spelled as set up, or raise ValueError naming what is unknown."""
    options = {name_key(name): name for name in configured}
    options[name_key(NO_SERVICE_TYPE)] = NO_SERVICE_TYPE
    unknown = [name for name in selected if name_key(name) not in options]
    if unknown:
        label = DEPARTMENT_LABELS.get(department, department)
        names = ", ".join(f"'{name}'" for name in unknown)
        raise ValueError(
            f"Service type {names} is not set up for {label}."
            if len(unknown) == 1
            else f"Service types {names} are not set up for {label}."
        )
    return [options[name_key(name)] for name in selected]


async def configured_service_names(database) -> dict[str, list[str]]:
    by_department: dict[str, list[str]] = {key: [] for key in DEPARTMENT_LABELS}
    for item in await read_service_types(database):
        by_department.setdefault(item["department"], []).append(item["name"])
    return by_department
