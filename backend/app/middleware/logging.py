from __future__ import annotations

import logging
import time
import uuid
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("agrio.access")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Any) -> Response:
        correlation_id = str(uuid.uuid4())
        request.state.correlation_id = correlation_id

        start = time.perf_counter()
        response: Response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        logger.info(
            "%s %s -> %s (%.2fms) [%s]",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            correlation_id,
        )
        response.headers["X-Correlation-ID"] = correlation_id
        return response
