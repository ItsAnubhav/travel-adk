from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, artifacts, auth, chat, health, personalization
from app.config import get_settings
from app.core.chat_history import chat_history_store
from app.core.control_plane import control_plane
from app.core.logging import configure_logging

configure_logging()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await control_plane.initialize()
    await chat_history_store.initialize()
    yield


app = FastAPI(title="ADK Travel Agents", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(artifacts.router, prefix="/api")
app.include_router(personalization.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
