import re
import time

from core.collections import CLINIC_CONTACTS, PUBLIC_TRACKING
from core.database import db
from core.models import BaseDocument
from core.security import current_account
from fastapi import APIRouter, Depends, HTTPException
from seed.loader import ensure_demo_data

router = APIRouter(prefix="/api", tags=["logistics"], dependencies=[Depends(ensure_demo_data)])
TOKEN_PATTERN = re.compile(r"^[a-f0-9]{48}$")


@router.get("/tracking/{token}")
async def public_tracking(token: str) -> dict:
    """Public clinic tracking page data. Only visit-level operational fields are stored here."""
    if not TOKEN_PATTERN.match(token):
        raise HTTPException(status_code=400, detail="The tracking link is invalid.")
    doc = await db[PUBLIC_TRACKING].find_one({"_id": token})
    now_ms = int(time.time() * 1000)
    if not doc or doc.get("active") is False or doc.get("expiresAtMs", 0) <= now_ms:
        raise HTTPException(status_code=404, detail="This tracking link is unavailable or has expired.")
    data = BaseDocument.from_mongo(doc).to_api()
    if "driverLat" in data:
        data["locationUpdatedAt"] = now_ms  # demo: simulate a fresh GPS ping from the driver's phone
    return data


@router.get("/clinics/{clinic_id}/contact", dependencies=[Depends(current_account)])
async def clinic_contact(clinic_id: str) -> dict:
    """Protected clinic contact fields (encrypted at rest in the original Firebase build)."""
    doc = await db[CLINIC_CONTACTS].find_one({"_id": clinic_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return BaseDocument.from_mongo(doc).to_api()
