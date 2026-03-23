from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import RefreshToken, User


class AuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_user_by_email(self, email: str) -> User | None:
        raise NotImplementedError  # TODO: query users by email

    async def create_user(
        self,
        email: str,
        hashed_password: str,
        display_name: str | None = None,
    ) -> User:
        raise NotImplementedError  # TODO: insert new user row

    async def save_refresh_token(
        self,
        user_id: uuid.UUID,
        token: str,
        expires_at: datetime,
    ) -> RefreshToken:
        raise NotImplementedError  # TODO: persist refresh token
