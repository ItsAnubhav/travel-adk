from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from channel_gateway.app.agent_client import AgentClient
from channel_gateway.app.channels import (
    email_polling,
    email_smtp,
    microsoft_graph_email,
    telegram,
    whatsapp_twilio,
)
from channel_gateway.app.config import get_settings
from channel_gateway.app.session_store import ChannelSessionStore

settings = get_settings()
store = ChannelSessionStore(settings.gateway_database_url)
agent_client = AgentClient(settings)
graph_client = microsoft_graph_email.MicrosoftGraphClient(settings)
email_stop_event = asyncio.Event()
graph_stop_event = asyncio.Event()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await store.initialize()
    poller = asyncio.create_task(
        email_polling.run_email_polling(
            settings,
            store,
            agent_client,
            email_smtp.send_email_reply,
            email_stop_event,
        )
    )
    graph_subscription_manager = asyncio.create_task(
        microsoft_graph_email.run_subscription_manager(
            settings,
            store,
            graph_client,
            graph_stop_event,
        )
    )
    yield
    email_stop_event.set()
    graph_stop_event.set()
    await poller
    await graph_subscription_manager


app = FastAPI(title="ADK Channel Gateway", version="0.1.0", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(telegram.build_router(settings, store, agent_client))
app.include_router(whatsapp_twilio.build_router(settings, store, agent_client))
app.include_router(microsoft_graph_email.build_router(settings, store, agent_client, graph_client))
