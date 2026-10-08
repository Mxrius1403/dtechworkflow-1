from datetime import date, datetime, timezone

from bson import ObjectId
from core.database import db
from core.security import current_account, require_roles
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator

router = APIRouter(
    prefix="/api/reports",
    tags=["reports"],
)
MANAGERS = Depends(require_roles("owner", "manager"))


class ReportSave(BaseModel):
    from_date: date = Field(alias="from")
    to_date: date = Field(alias="to")
    title: str = Field(default="Production Report", min_length=1, max_length=120)
    data: dict

    @model_validator(mode="after")
    def validate_report_period(self):
        if self.from_date > self.to_date:
            raise ValueError("Report start date must be on or before its end date.")
        if (
            self.data.get("from") != self.from_date.isoformat()
            or self.data.get("to") != self.to_date.isoformat()
        ):
            raise ValueError("Report data must match the selected period.")
        return self


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[MANAGERS])
async def save_report(
    body: ReportSave,
    account: dict = Depends(current_account),
) -> dict:
    report = {
        "_id": str(ObjectId()),
        "title": body.title.strip() or "Production Report",
        "from": body.from_date.isoformat(),
        "to": body.to_date.isoformat(),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "createdById": str(account["_id"]),
        "data": body.data,
    }
    await db["saved_reports"].insert_one(report)
    report["id"] = report.pop("_id")
    return report


@router.delete("/{report_id}", dependencies=[MANAGERS])
async def delete_report(report_id: str) -> dict:
    result = await db["saved_reports"].delete_one({"_id": report_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Saved report not found.")
    return {"id": report_id, "deleted": True}
