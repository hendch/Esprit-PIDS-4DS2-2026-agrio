from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.modules.community.service import CommunityService
from app.persistence.db import get_async_session

from .schemas import CommentCreate, CommentResponse, PostCreate, PostResponse

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_async_session)]

CATEGORIES = [
    {"key": "price_talk",       "label": "Price Talk",       "label_ar": "نقاش الأسعار",      "emoji": "🌾"},
    {"key": "livestock_advice", "label": "Livestock Advice",  "label_ar": "نصائح الماشية",     "emoji": "🐄"},
    {"key": "crop_disease",     "label": "Crop & Disease",    "label_ar": "المحاصيل والأمراض", "emoji": "🌿"},
    {"key": "irrigation",       "label": "Irrigation",        "label_ar": "الري",              "emoji": "💧"},
    {"key": "buy_sell",         "label": "Buy & Sell",        "label_ar": "بيع وشراء",         "emoji": "📢"},
    {"key": "general",          "label": "General",           "label_ar": "عام",               "emoji": "❓"},
]


@router.get("/categories")
async def get_categories() -> list[dict]:
    return CATEGORIES


@router.get("/feed", response_model=list[PostResponse])
async def get_feed(
    db: DbSession,
    current_user: dict = Depends(get_current_user),
    category: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[dict]:
    user_id = uuid.UUID(current_user["user_id"])
    return await CommunityService.get_feed(db, user_id, category=category, skip=skip, limit=limit)


@router.post("/posts", response_model=PostResponse, status_code=201)
async def create_post(
    body: PostCreate,
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    user_id = uuid.UUID(current_user["user_id"])
    try:
        return await CommunityService.create_post(
            db, user_id, body.content, body.category, body.media_url
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: uuid.UUID,
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    user_id = uuid.UUID(current_user["user_id"])
    deleted = await CommunityService.delete_post(db, post_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Post '{post_id}' not found or not owned by you")
    return {"deleted": True}


@router.get("/posts/{post_id}/comments", response_model=list[CommentResponse])
async def get_comments(
    post_id: uuid.UUID,
    db: DbSession,
    current_user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50,
) -> list[dict]:
    user_id = uuid.UUID(current_user["user_id"])
    return await CommunityService.get_comments(db, post_id, user_id, skip=skip, limit=limit)


@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=201)
async def add_comment(
    post_id: uuid.UUID,
    body: CommentCreate,
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    user_id = uuid.UUID(current_user["user_id"])
    try:
        return await CommunityService.add_comment(db, post_id, user_id, body.content)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.delete("/posts/{post_id}/comments/{comment_id}")
async def delete_comment(
    post_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    user_id = uuid.UUID(current_user["user_id"])
    deleted = await CommunityService.delete_comment(db, comment_id, user_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Comment '{comment_id}' not found or not owned by you",
        )
    return {"deleted": True}


@router.post("/posts/{post_id}/like")
async def toggle_like(
    post_id: uuid.UUID,
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    user_id = uuid.UUID(current_user["user_id"])
    try:
        return await CommunityService.toggle_like(db, post_id, user_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
