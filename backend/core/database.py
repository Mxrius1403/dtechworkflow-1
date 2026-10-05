from motor.motor_asyncio import AsyncIOMotorClient

from core.config import DB_NAME, MONGO_URL

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
