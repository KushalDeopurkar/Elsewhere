from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.events import router as events_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: could start scheduler here later
    yield
    # Shutdown: cleanup


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Event Discovery Engine",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(events_router, prefix="/api/events", tags=["events"])
    return app


app = create_app()
