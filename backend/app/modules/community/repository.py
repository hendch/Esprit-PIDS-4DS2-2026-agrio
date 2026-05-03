from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.community.models import Post, PostComment, PostLike


class CommunityRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_posts(
        self,
        category: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ):
        stmt = (
            select(Post, User.display_name.label("user_display_name"))
            .join(User, Post.user_id == User.id)
            .where(Post.is_active == True)  # noqa: E712
        )
        if category is not None:
            stmt = stmt.where(Post.category == category)
        stmt = stmt.order_by(Post.created_at.desc()).offset(skip).limit(limit)
        result = await self._session.execute(stmt)
        return result.all()

    async def get_post(self, post_id: uuid.UUID) -> Post | None:
        stmt = select(Post).where(Post.id == post_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_post(self, user_id: uuid.UUID, data: dict) -> Post:
        post = Post(user_id=user_id, **data)
        self._session.add(post)
        await self._session.commit()
        await self._session.refresh(post)
        return post

    async def delete_post(self, post_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        post = await self.get_post(post_id)
        if post is None or post.user_id != user_id:
            return False
        post.is_active = False
        await self._session.commit()
        return True

    async def get_comments(
        self,
        post_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
    ):
        stmt = (
            select(PostComment, User.display_name.label("user_display_name"))
            .join(User, PostComment.user_id == User.id)
            .where(PostComment.post_id == post_id, PostComment.is_active == True)  # noqa: E712
            .order_by(PostComment.created_at.asc())
            .offset(skip)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return result.all()

    async def create_comment(
        self, post_id: uuid.UUID, user_id: uuid.UUID, content: str
    ) -> PostComment:
        comment = PostComment(post_id=post_id, user_id=user_id, content=content)
        self._session.add(comment)
        await self._session.execute(
            update(Post)
            .where(Post.id == post_id)
            .values(comments_count=Post.comments_count + 1)
        )
        await self._session.commit()
        await self._session.refresh(comment)
        return comment

    async def delete_comment(self, comment_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        stmt = select(PostComment).where(PostComment.id == comment_id)
        result = await self._session.execute(stmt)
        comment = result.scalar_one_or_none()
        if comment is None or comment.user_id != user_id or not comment.is_active:
            return False
        comment.is_active = False
        await self._session.execute(
            update(Post)
            .where(Post.id == comment.post_id)
            .values(comments_count=Post.comments_count - 1)
        )
        await self._session.commit()
        return True

    async def toggle_like(self, post_id: uuid.UUID, user_id: uuid.UUID) -> dict:
        stmt = select(PostLike).where(
            PostLike.post_id == post_id,
            PostLike.user_id == user_id,
        )
        result = await self._session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing is not None:
            await self._session.delete(existing)
            await self._session.execute(
                update(Post)
                .where(Post.id == post_id)
                .values(likes_count=Post.likes_count - 1)
            )
        else:
            self._session.add(PostLike(post_id=post_id, user_id=user_id))
            await self._session.execute(
                update(Post)
                .where(Post.id == post_id)
                .values(likes_count=Post.likes_count + 1)
            )

        await self._session.commit()
        post = await self.get_post(post_id)
        return {
            "liked": existing is None,
            "likes_count": post.likes_count if post else 0,
        }

    async def get_user_liked_posts(
        self, user_id: uuid.UUID, post_ids: list[uuid.UUID]
    ) -> set[uuid.UUID]:
        if not post_ids:
            return set()
        stmt = select(PostLike.post_id).where(
            PostLike.user_id == user_id,
            PostLike.post_id.in_(post_ids),
        )
        result = await self._session.execute(stmt)
        return set(result.scalars().all())
