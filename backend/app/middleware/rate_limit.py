from __future__ import annotations

from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RateLimitMiddleware(BaseHTTPMiddleware):
    # TODO: implement sliding-window rate limiting per client IP / user
    async def dispatch(self, request: Request, call_next: Any) -> Response:
        return await call_next(request)
