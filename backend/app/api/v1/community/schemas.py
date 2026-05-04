from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PostCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)
    category: str
    media_url: str | None = None


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)


class PostResponse(BaseModel):
    id: str
    user_id: str
    user_display_name: str | None
    content: str
    category: str
    media_url: str | None
    likes_count: int
    comments_count: int
    created_at: str | None
    liked_by_me: bool
    is_mine: bool


class CommentResponse(BaseModel):
    id: str
    post_id: str
    user_id: str
    user_display_name: str | None
    content: str
    created_at: str | None
    is_mine: bool
