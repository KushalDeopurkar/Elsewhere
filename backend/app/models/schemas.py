from typing import Any, Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class Meta(BaseModel):
    total: int | None = None
    limit: int | None = None
    offset: int | None = None


class ApiResponse(BaseModel, Generic[T]):
    data: T | None = None
    error: str | None = None
    meta: Meta | None = None
