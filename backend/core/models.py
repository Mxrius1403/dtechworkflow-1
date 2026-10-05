from typing import Annotated, Any

from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    """Every stored record: Mongo `_id` is exposed to the API as `id`."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: PyObjectId = Field(alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict[str, Any]) -> "BaseDocument":
        return cls.model_validate(doc)

    def to_mongo(self) -> dict[str, Any]:
        data = self.model_dump()
        data["_id"] = data.pop("id")
        return data

    def to_api(self) -> dict[str, Any]:
        return self.model_dump()
