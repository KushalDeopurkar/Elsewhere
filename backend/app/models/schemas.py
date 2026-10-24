from __future__ import annotations

from typing import Any, Generic, Optional, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class Meta(BaseModel):
    total: Optional[int] = None
    limit: Optional[int] = None
    offset: Optional[int] = None


class ApiResponse(BaseModel, Generic[T]):
    data: Optional[T] = None
    error: Optional[str] = None
    meta: Optional[Meta] = None
