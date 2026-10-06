import json
from functools import lru_cache

from core.config import DATA_DIR
from core.security import current_account
from fastapi import APIRouter, Depends

router = APIRouter(
    prefix="/api/catalog",
    tags=["catalog"],
    dependencies=[Depends(current_account)],
)


@lru_cache(maxsize=4)
def load_json(filename: str):
    return json.loads((DATA_DIR / filename).read_text())


@router.get("")
async def catalog() -> dict:
    """Static references: TDS material products and tooth groups for orders."""
    materials = [
        {
            **product,
            "group": (
                "Prosthesis"
                if product.get("group") == "Denture"
                else product["group"]
            ),
            "subgroup": product.get("subgroup", "").replace(
                "Denture", "Prosthesis", 1
            ),
        }
        for product in load_json("materials.json")
    ]
    return {
        "materials": materials,
        "toothGroups": load_json("tooth_groups.json"),
    }
