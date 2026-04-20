from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.settings import settings


async def autonomous_worker():
    from app.modules.irrigation.repository import IrrigationRepository
    from app.api.v1.irrigation.routes import _get_agent
    from app.persistence.db import AsyncSessionLocal

    SLEEP_SECONDS = 60 * 60 * 6

    while True:
        try:
            async with AsyncSessionLocal() as session:
                repo = IrrigationRepository(session)
                is_on = await repo.get_autonomous_state()

            if is_on:
                logging.info("[Autonomous Worker] Mode ON. Evaluating field...")
                agent = _get_agent()
                await asyncio.to_thread(
                    agent.run,
                    query="System Background Tick: Should I irrigate the field A1?",
                    crop="wheat",
                    growth_stage="mid",
                    lat=36.8,
                    lon=10.18,
                )
        except Exception as e:
            logging.error("[Autonomous Worker] Failed execution: %s", e)

        await asyncio.sleep(SLEEP_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    from app.persistence.db import init_models

    await init_models()
    task = asyncio.create_task(autonomous_worker())
    yield
    task.cancel()


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
    from app.middleware.auth import AuthMiddleware
    from app.middleware.cors import add_cors
    from app.middleware.logging import LoggingMiddleware

    # Last added = outermost. CORS must run first so OPTIONS preflight gets Allow-* headers
    # before AuthMiddleware returns 401 without Authorization.
    application.add_middleware(LoggingMiddleware)
    application.add_middleware(AuthMiddleware)
    add_cors(application)


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
    from app.api.v1.ml_crop.routes import router as ml_crop_router

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
    
    application.include_router(ml_crop_router, prefix=f"{prefix}/ml", tags=["ml-crop"])


app = create_app()
