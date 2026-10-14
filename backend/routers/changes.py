from core.changes import read_changes
from core.database import db
from core.security import current_account
from fastapi import APIRouter, Depends

router = APIRouter(
    prefix="/api/changes",
    tags=["changes"],
    dependencies=[Depends(current_account)],
)


@router.get("")
async def list_changes() -> dict[str, int]:
    """How often each area has changed. Screens reload an area when its number moves."""
    return await read_changes(db)
