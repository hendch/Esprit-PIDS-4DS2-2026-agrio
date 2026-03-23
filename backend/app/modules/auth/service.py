from __future__ import annotations

from jose import jwt

from app.modules.auth.models import User
from app.modules.auth.repository import AuthRepository
from app.settings import settings


class AuthService:
    def __init__(self, repo: AuthRepository) -> None:
        self._repo = repo

    async def register(
        self,
        email: str,
        password: str,
        display_name: str | None = None,
    ) -> User:
        raise NotImplementedError  # TODO: hash password, call repo.create_user

    async def login(self, email: str, password: str) -> tuple[str, str]:
        raise NotImplementedError  # TODO: verify credentials, issue JWT pair

    def verify_token(self, token: str) -> dict:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
