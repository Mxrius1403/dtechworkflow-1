from core.collections import SETTINGS
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument


async def allocate_order_id(
    database: AsyncIOMotorDatabase,
    counter_field: str,
    prefix: str,
) -> str:
    settings = await database[SETTINGS].find_one_and_update(
        {"_id": "app"},
        {"$inc": {counter_field: 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if not settings:
        raise RuntimeError(f"Could not advance the {counter_field} counter.")
    return f"{prefix}{settings[counter_field]}"
