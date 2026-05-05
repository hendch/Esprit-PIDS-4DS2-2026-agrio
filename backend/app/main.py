from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.settings import settings

logger = logging.getLogger(__name__)


async def _alert_checker_loop() -> None:
    from app.modules.notification.alert_checker import PriceAlertChecker
    from app.modules.notification.vaccination_checker import VaccinationChecker
    from app.persistence.db import AsyncSessionLocal

    price_checker = PriceAlertChecker()
    vax_checker = VaccinationChecker()

    while True:
        try:
            async with AsyncSessionLocal() as db:
                price_result = await price_checker.check_all(db)
                if price_result["triggered"] > 0:
                    logging.info(
                        "[AlertChecker] %d alert(s) fired, %d checked, %d errors",
                        price_result["triggered"],
                        price_result["checked"],
                        price_result["errors"],
                    )

            async with AsyncSessionLocal() as db:
                vax_result = await vax_checker.check_all(db)
                if vax_result["reminded"] > 0:
                    logging.info(
                        "[VaxChecker] %d vaccination reminder(s) sent, %d checked, %d errors",
                        vax_result["reminded"],
                        vax_result["checked"],
                        vax_result["errors"],
                    )
        except Exception as e:
            logging.error("[CheckerLoop] error: %s", e)
        await asyncio.sleep(3600)


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
    alert_task = asyncio.create_task(_alert_checker_loop())

    if settings.market_retrain_on_startup:
        from app.modules.market_prices.pipeline import ForecastPipeline
        from app.modules.market_prices.data.loader import ALL_SERIES

        async def _retrain_all() -> None:
            pipeline = ForecastPipeline()
            for series_name in ALL_SERIES:
                try:
                    pipeline.run(series_name=series_name, horizon=12, model="auto")
                    logger.info("market retrain OK: %s", series_name)
                except Exception as exc:
                    logger.warning("market retrain SKIP %s: %s", series_name, exc)

        asyncio.create_task(_retrain_all())
        logger.info("Market price forecast pipeline started in background")

    yield
    task.cancel()
    alert_task.cancel()


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        debug=settings.debug,
        lifespan=lifespan,
    )
    _register_middleware(application)
    _register_routers(application)

    upload_dir = Path("./media_uploads")
    upload_dir.mkdir(exist_ok=True)
    application.mount("/media_uploads", StaticFiles(directory=upload_dir), name="media_uploads")

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
    from app.api.v1.messaging.routes import router as messaging_router
    from app.api.v1.ai.routes import router as ai_router
    from app.api.v1.analytics.routes import router as analytics_router
    from app.api.v1.auth.routes import router as auth_router
    from app.api.v1.disease.routes import router as disease_router
    from app.api.v1.fields.routes import router as fields_router
    from app.api.v1.fertilizer.routes import router as fertilizer_router
    from app.api.v1.health.routes import router as health_router
    from app.api.v1.irrigation.routes import router as irrigation_router
    from app.api.v1.ledger.routes import router as ledger_router
    from app.api.v1.livestock.routes import router as livestock_router
    from app.api.v1.market_prices.routes import router as market_prices_router
    from app.api.v1.notifications import router as notifications_router
    from app.api.v1.community.routes import router as community_router
    from app.api.v1.media.routes import router as media_router
    from app.api.v1.produce_prices.routes import router as produce_prices_router
    from app.api.v1.satellite.routes import router as satellite_router

    

    application.include_router(health_router, tags=["health"])

    prefix = "/api/v1"
    application.include_router(auth_router, prefix=f"{prefix}/auth", tags=["auth"])
    application.include_router(fields_router, prefix=f"{prefix}/fields", tags=["fields"])
    application.include_router(
        fertilizer_router, prefix=f"{prefix}/fertilizer", tags=["fertilizer"]
    )
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
    application.include_router(
        market_prices_router,
        prefix=f"{prefix}/market-prices",
        tags=["market_prices"],
    )
    application.include_router(
        notifications_router,
        prefix=f"{prefix}/notifications",
        tags=["notifications"],
    )
    application.include_router(
        community_router,
        prefix=f"{prefix}/community",
        tags=["Community"],
    )
    application.include_router(
        media_router,
        prefix=f"{prefix}/media",
        tags=["media"],
    )
    application.include_router(
        produce_prices_router,
        prefix=f"{prefix}/produce-prices",
        tags=["produce_prices"],
    )

    application.include_router(
        messaging_router, prefix=f"{prefix}/messaging", tags=["messaging"]
    )

app = create_app()
