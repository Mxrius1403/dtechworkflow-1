import json
from functools import lru_cache

from fastapi import APIRouter

from core.config import DATA_DIR

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@lru_cache(maxsize=4)
def load_json(filename: str):
    return json.loads((DATA_DIR / filename).read_text())


@router.get("")
async def catalog() -> dict:
    """Static reference lists: TDS material products and tooth groups for tooth orders."""
    return {"materials": load_json("materials.json"), "toothGroups": load_json("tooth_groups.json")}
