from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # TODO: initialise async DB engine / run startup migrations
    # TODO: warm up ML model cache if needed
    yield
    # TODO: dispose DB engine pool
    # TODO: flush any pending background tasks


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        debug=settings.debug,
        lifespan=lifespan,
    )
    _register_middleware(application)
    _register_routers(application)
    return application


def _register_middleware(application: FastAPI) -> None:
    from app.middleware.cors import add_cors
    from app.middleware.logging import LoggingMiddleware

    add_cors(application)
    application.add_middleware(LoggingMiddleware)


def _register_routers(application: FastAPI) -> None:
    from app.api.v1.ai.routes import router as ai_router
    from app.api.v1.analytics.routes import router as analytics_router
    from app.api.v1.auth.routes import router as auth_router
    from app.api.v1.disease.routes import router as disease_router
    from app.api.v1.fields.routes import router as fields_router
    from app.api.v1.health.routes import router as health_router
    from app.api.v1.irrigation.routes import router as irrigation_router
    from app.api.v1.ledger.routes import router as ledger_router
    from app.api.v1.livestock.routes import router as livestock_router
    from app.api.v1.satellite.routes import router as satellite_router

    application.include_router(health_router, tags=["health"])

    prefix = "/api/v1"
    application.include_router(auth_router, prefix=f"{prefix}/auth", tags=["auth"])
    application.include_router(fields_router, prefix=f"{prefix}/fields", tags=["fields"])
    application.include_router(
        irrigation_router, prefix=f"{prefix}/irrigation", tags=["irrigation"]
    )
    application.include_router(
        satellite_router, prefix=f"{prefix}/satellite", tags=["satellite"]
    )
    application.include_router(disease_router, prefix=f"{prefix}/disease", tags=["disease"])
    application.include_router(
        livestock_router, prefix=f"{prefix}/livestock", tags=["livestock"]
    )
    application.include_router(
        analytics_router, prefix=f"{prefix}/analytics", tags=["analytics"]
    )
    application.include_router(ai_router, prefix=f"{prefix}/ai", tags=["ai"])
    application.include_router(ledger_router, prefix=f"{prefix}/ledger", tags=["ledger"])


app = create_app()
