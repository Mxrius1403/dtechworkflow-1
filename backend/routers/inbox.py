from core.collections import INBOX
from core.database import db
from core.inbox import inbox_message_to_api
from core.security import current_account, require_roles
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter(
    prefix="/api/inbox",
    tags=["inbox"],
    dependencies=[Depends(require_roles("owner", "manager"))],
)
MAX_MESSAGES = 300


class InboxReadUpdate(BaseModel):
    read: bool


def _own(message_id: str, account: dict) -> dict:
    return {"_id": message_id, "recipientId": str(account["_id"])}


@router.get("")
async def list_inbox(account: dict = Depends(current_account)) -> dict:
    recipient = {"recipientId": str(account["_id"])}
    docs = (
        await db[INBOX]
        .find(recipient)
        .sort("createdAt", -1)
        .limit(MAX_MESSAGES)
        .to_list(MAX_MESSAGES)
    )
    unread = await db[INBOX].count_documents({**recipient, "read": False})
    return {"messages": [inbox_message_to_api(doc) for doc in docs], "unread": unread}


@router.patch("/{message_id}")
async def set_inbox_read(
    message_id: str,
    body: InboxReadUpdate,
    account: dict = Depends(current_account),
) -> dict:
    result = await db[INBOX].update_one(
        _own(message_id, account), {"$set": {"read": body.read}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Message not found.")
    return {"id": message_id, "read": body.read}


@router.post("/read-all")
async def mark_all_inbox_read(account: dict = Depends(current_account)) -> dict:
    result = await db[INBOX].update_many(
        {"recipientId": str(account["_id"]), "read": False},
        {"$set": {"read": True}},
    )
    return {"updated": result.modified_count}


@router.delete("/{message_id}")
async def delete_inbox_message(
    message_id: str, account: dict = Depends(current_account)
) -> dict:
    result = await db[INBOX].delete_one(_own(message_id, account))
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found.")
    return {"id": message_id, "deleted": True}
