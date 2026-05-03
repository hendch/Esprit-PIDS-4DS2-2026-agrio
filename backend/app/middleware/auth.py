from __future__ import annotations

import json
from typing import Any

from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.settings import settings

# Only these paths skip JWT. Do not use a broad "/auth/" match — e.g. `/api/v1/auth/me` must verify Bearer.
_SKIP_PREFIXES = ("/health", "/docs", "/openapi", "/redoc", "/media_uploads")
_PUBLIC_AUTH_PATHS = frozenset(
    {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/api/v1/community/categories",
        "/api/v1/gamification/leaderboard",
    }
)


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Any) -> Response:
        path = request.url.path

        normalized = path.rstrip("/") or "/"
        if normalized in _PUBLIC_AUTH_PATHS:
            return await call_next(request)

        if any(path.startswith(seg) for seg in _SKIP_PREFIXES):
            return await call_next(request)

        auth_header: str | None = request.headers.get("authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return _unauthorized("Missing or malformed Authorization header")

        token = auth_header[len("Bearer "):]
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=[settings.jwt_algorithm],
            )
            request.state.user_id = payload["sub"]
            request.state.farm_id = payload.get("farm_id")
        except (JWTError, KeyError):
            return _unauthorized("Invalid or expired token")

        return await call_next(request)


def _unauthorized(detail: str) -> Response:
    return Response(
        content=json.dumps({"detail": detail}),
        status_code=401,
        media_type="application/json",
    )


async def get_current_user(request: Request) -> dict:
    user_id: str | None = getattr(request.state, "user_id", None)
    farm_id: str | None = getattr(request.state, "farm_id", None)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"user_id": user_id, "farm_id": farm_id}


CurrentUser = Depends(get_current_user)
