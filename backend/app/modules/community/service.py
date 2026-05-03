from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.community.models import Post, PostComment
from app.modules.community.repository import CommunityRepository

VALID_CATEGORIES = [
    "price_talk",
    "livestock_advice",
    "crop_disease",
    "irrigation",
    "buy_sell",
    "general",
]


def _post_row_to_dict(row, liked_ids: set, current_user_id: uuid.UUID) -> dict:
    post: Post = row.Post
    return {
        "id": str(post.id),
        "user_id": str(post.user_id),
        "user_display_name": row.user_display_name,
        "content": post.content,
        "category": post.category,
        "media_url": post.media_url,
        "likes_count": post.likes_count,
        "comments_count": post.comments_count,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "liked_by_me": post.id in liked_ids,
        "is_mine": post.user_id == current_user_id,
        "user_is_verified_farmer": bool(getattr(row, "user_is_verified_farmer", False)),
        "user_avatar_url": getattr(row, "user_avatar_url", None),
    }


def _comment_row_to_dict(row, current_user_id: uuid.UUID) -> dict:
    comment: PostComment = row.PostComment
    return {
        "id": str(comment.id),
        "post_id": str(comment.post_id),
        "user_id": str(comment.user_id),
        "user_display_name": row.user_display_name,
        "user_avatar_url": getattr(row, "user_avatar_url", None),
        "content": comment.content,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "is_mine": comment.user_id == current_user_id,
    }


def _post_to_dict(post: Post) -> dict:
    return {
        "id": str(post.id),
        "user_id": str(post.user_id),
        "content": post.content,
        "category": post.category,
        "media_url": post.media_url,
        "likes_count": post.likes_count,
        "comments_count": post.comments_count,
        "created_at": post.created_at.isoformat() if post.created_at else None,
    }


def _comment_to_dict(comment: PostComment) -> dict:
    return {
        "id": str(comment.id),
        "post_id": str(comment.post_id),
        "user_id": str(comment.user_id),
        "content": comment.content,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
    }


class CommunityService:

    @staticmethod
    async def get_feed(
        db: AsyncSession,
        current_user_id: uuid.UUID,
        category: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> list[dict]:
        repo = CommunityRepository(db)
        rows = await repo.get_posts(category=category, skip=skip, limit=limit)
        post_ids = [row.Post.id for row in rows]
        liked_ids = await repo.get_user_liked_posts(current_user_id, post_ids)
        return [_post_row_to_dict(row, liked_ids, current_user_id) for row in rows]

    @staticmethod
    async def create_post(
        db: AsyncSession,
        user_id: uuid.UUID,
        content: str,
        category: str,
        media_url: str | None = None,
    ) -> dict:
        if category not in VALID_CATEGORIES:
            raise ValueError(
                f"Invalid category '{category}'. Valid: {VALID_CATEGORIES}"
            )
        if not (1 <= len(content) <= 1000):
            raise ValueError("Content must be 1–1000 characters.")
        repo = CommunityRepository(db)
        post = await repo.create_post(
            user_id,
            {"content": content, "category": category, "media_url": media_url},
        )
        result = await db.execute(
            select(User.display_name, User.is_verified_farmer).where(User.id == user_id)
        )
        user_row = result.one_or_none()
        return {
            **_post_to_dict(post),
            "user_display_name": user_row.display_name if user_row else None,
            "user_is_verified_farmer": bool(user_row.is_verified_farmer) if user_row else False,
            "user_avatar_url": user_row.avatar_url if user_row else None,
            "liked_by_me": False,
            "is_mine": True,
        }

    @staticmethod
    async def delete_post(
        db: AsyncSession, post_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        repo = CommunityRepository(db)
        return await repo.delete_post(post_id, user_id)

    @staticmethod
    async def get_comments(
        db: AsyncSession,
        post_id: uuid.UUID,
        current_user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> list[dict]:
        repo = CommunityRepository(db)
        rows = await repo.get_comments(post_id, skip=skip, limit=limit)
        return [_comment_row_to_dict(row, current_user_id) for row in rows]

    @staticmethod
    async def add_comment(
        db: AsyncSession,
        post_id: uuid.UUID,
        user_id: uuid.UUID,
        content: str,
    ) -> dict:
        if not (1 <= len(content) <= 500):
            raise ValueError("Comment must be 1–500 characters.")
        repo = CommunityRepository(db)
        post = await repo.get_post(post_id)
        if post is None or not post.is_active:
            raise LookupError(f"Post '{post_id}' not found or inactive.")
        comment = await repo.create_comment(post_id, user_id, content)
        result = await db.execute(
            select(User.display_name, User.avatar_url).where(User.id == user_id)
        )
        user_row = result.one_or_none()
        return {
            **_comment_to_dict(comment),
            "user_display_name": user_row.display_name if user_row else None,
            "user_avatar_url": user_row.avatar_url if user_row else None,
            "is_mine": True,
        }

    @staticmethod
    async def delete_comment(
        db: AsyncSession, comment_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        repo = CommunityRepository(db)
        return await repo.delete_comment(comment_id, user_id)

    @staticmethod
    async def toggle_like(
        db: AsyncSession, post_id: uuid.UUID, user_id: uuid.UUID
    ) -> dict:
        repo = CommunityRepository(db)
        post = await repo.get_post(post_id)
        if post is None or not post.is_active:
            raise LookupError(f"Post '{post_id}' not found or inactive.")
        return await repo.toggle_like(post_id, user_id)
