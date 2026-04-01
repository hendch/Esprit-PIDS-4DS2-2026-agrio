from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
from jose import jwt

from app.modules.auth.models import User
from app.modules.auth.repository import AuthRepository
from app.settings import settings


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]

    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode("utf-8")
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]

    return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))


class AuthService:
    def __init__(self, repo: AuthRepository) -> None:
        self._repo = repo

    async def register(
        self,
        email: str,
        password: str,
        display_name: str | None = None,
    ) -> User:
        existing_user = await self._repo.get_user_by_email(email)
        if existing_user is not None:
            raise ValueError("Email is already registered")

        hashed_password = hash_password(password)
        return await self._repo.create_user(
            email=email,
            hashed_password=hashed_password,
            display_name=display_name,
        )

    async def login(self, email: str, password: str) -> tuple[str, str, int]:
        user = await self._repo.get_user_by_email(email)
        if user is None:
            raise ValueError("Account not found. Please sign up first.")
        if not verify_password(password, user.hashed_password):
            raise ValueError("Invalid email or password")
        if not user.is_active:
            raise ValueError("Account is disabled")

        access_token = self._create_access_token(user.id)
        refresh_token = await self._create_refresh_token(user.id)
        return access_token, refresh_token, settings.jwt_expire_minutes * 60

    async def refresh_access_token(self, refresh_token: str) -> tuple[str, str, int]:
        stored_token = await self._repo.get_refresh_token(refresh_token)
        if stored_token is None:
            raise ValueError("Invalid refresh token")
        if stored_token.revoked or stored_token.expires_at <= datetime.now(UTC):
            raise ValueError("Expired or revoked refresh token")

        user = await self._repo.get_user_by_id(stored_token.user_id)
        if user is None or not user.is_active:
            raise ValueError("User not found or inactive")

        await self._repo.revoke_refresh_token(refresh_token)
        access_token = self._create_access_token(user.id)
        new_refresh_token = await self._create_refresh_token(user.id)
        return access_token, new_refresh_token, settings.jwt_expire_minutes * 60

    async def get_profile(self, user_id: uuid.UUID) -> User:
        user = await self._repo.get_user_by_id(user_id)
        if user is None:
            raise ValueError("User not found")
        return user

    async def update_profile(
        self,
        user_id: uuid.UUID,
        *,
        email: str | None = None,
        display_name: str | None = None,
    ) -> User:
        if email is not None:
            existing_user = await self._repo.get_user_by_email(email)
            if existing_user is not None and existing_user.id != user_id:
                raise ValueError("Email is already registered")

        updated_user = await self._repo.update_user(
            user_id=user_id,
            email=email,
            display_name=display_name,
        )
        if updated_user is None:
            raise ValueError("User not found")
        return updated_user

    async def change_password(
        self,
        user_id: uuid.UUID,
        *,
        current_password: str,
        new_password: str,
    ) -> None:
        user = await self._repo.get_user_by_id(user_id)
        if user is None:
            raise ValueError("User not found")
        if not verify_password(current_password, user.hashed_password):
            raise ValueError("Current password is incorrect")

        hashed_password = hash_password(new_password)
        await self._repo.update_user(user_id=user_id, hashed_password=hashed_password)

    async def logout(self, refresh_token: str) -> None:
        await self._repo.revoke_refresh_token(refresh_token)

    def verify_token(self, token: str) -> dict:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )

    def _create_access_token(self, user_id: uuid.UUID) -> str:
        expires_at = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
        payload = {
            "sub": str(user_id),
            "exp": expires_at,
        }
        return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    async def _create_refresh_token(self, user_id: uuid.UUID) -> str:
        token = secrets.token_urlsafe(48)
        expires_at = datetime.now(UTC) + timedelta(days=settings.jwt_refresh_expire_days)
        await self._repo.save_refresh_token(user_id=user_id, token=token, expires_at=expires_at)
        return token
