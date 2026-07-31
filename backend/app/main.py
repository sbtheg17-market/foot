"""FastAPI app factory. All routes prefixed with /api.

Route map (backend):
  /api/                       -> health
  /api/auth/*                 -> auth
  /api/providers/me           -> provider profile / onboarding
  /api/services/*             -> provider service catalog (Checkpoint 2)
  /api/dashboard/*            -> provider dashboard aggregates
"""
import logging

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.mongo import close_client
from app.repositories import (
    availability_repository,
    login_attempt_repository,
    service_repository,
    user_repository,
)
from app.routers import auth, availability, dashboard, health, providers, services


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title="OnCall Foot API")

    api = APIRouter(prefix="/api")
    api.include_router(health.router)
    api.include_router(auth.router)
    api.include_router(providers.router)
    api.include_router(services.router)
    api.include_router(availability.router)
    api.include_router(dashboard.router)
    app.include_router(api)

    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=settings.CORS_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    async def _startup():
        await user_repository.ensure_indexes()
        await login_attempt_repository.ensure_indexes()
        await service_repository.ensure_indexes()
        await availability_repository.ensure_indexes()

    @app.on_event("shutdown")
    async def _shutdown():
        close_client()

    return app


app = create_app()
