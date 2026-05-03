from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile

from app.middleware.auth import get_current_user
from app.modules.media.storage.local_storage import LocalObjectStorage

router = APIRouter()

_storage = LocalObjectStorage(root_dir="./media_uploads")

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile,
    _: dict = Depends(get_current_user),
) -> dict:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported type '{file.content_type}'. Allowed: jpeg, png, webp, gif.",
        )

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB).")

    ext = "jpg"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()

    key = f"{uuid.uuid4()}.{ext}"
    await _storage.put(key, data, file.content_type or "image/jpeg")

    base = str(request.base_url).rstrip("/")
    return {"url": f"{base}/media_uploads/{key}", "filename": key}
