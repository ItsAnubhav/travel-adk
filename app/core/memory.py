from functools import lru_cache

from adk_database_memory import DatabaseMemoryService

from app.config import get_settings


@lru_cache
def get_memory_service() -> DatabaseMemoryService:
    return DatabaseMemoryService(get_settings().database_url)
