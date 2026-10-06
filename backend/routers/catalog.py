import json
from functools import lru_cache

from core.config import DATA_DIR
from core.security import current_account
from fastapi import APIRouter, Depends

router = APIRouter(prefix="/api/catalog", tags=["catalog"], dependencies=[Depends(current_account)])


@lru_cache(maxsize=4)
def load_json(filename: str):
    return json.loads((DATA_DIR / filename).read_text())


@router.get("")
async def catalog() -> dict:
    """Static reference lists: TDS material products and tooth groups for tooth orders."""
    return {"materials": load_json("materials.json"), "toothGroups": load_json("tooth_groups.json")}
