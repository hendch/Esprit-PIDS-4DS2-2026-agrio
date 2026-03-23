from __future__ import annotations

from fastapi import HTTPException, Request


async def get_current_farm_id(request: Request) -> str:
    farm_id: str | None = getattr(request.state, "farm_id", None)
    if not farm_id:
        raise HTTPException(status_code=403, detail="Farm context not available")
    return farm_id
