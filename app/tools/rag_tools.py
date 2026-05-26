from __future__ import annotations

from typing import Any

from google.adk.tools import ToolContext

from app.config import get_settings
from app.core.rag import rag_store
from app.tools.tool_contracts import compact_error, compact_success


def _company_id_from_context(tool_context: ToolContext | None) -> str:
    if tool_context is None:
        return ""
    for key in ("company_id", "companyId"):
        value = tool_context.state.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


async def search_company_documents(
    query: str,
    top_k: int = 5,
    tool_context: ToolContext | None = None,
) -> dict[str, Any]:
    """Search company-uploaded policy/manual/holiday documents for relevant snippets."""
    company_id = _company_id_from_context(tool_context)
    if not company_id:
        return compact_error("Cannot search documents without company_id in session state")
    if not str(query or "").strip():
        return compact_error("query is required")

    settings = get_settings()
    limit = max(1, min(top_k or settings.rag_top_k, 10))
    results = await rag_store.search(company_id=company_id, query=query, top_k=limit)
    if not results:
        return compact_success(
            "No relevant company document snippets found",
            {"query": query, "results": []},
        )

    snippets = [
        {
            "filename": item["filename"],
            "source_location": item["source_location"],
            "score": round(float(item["score"]), 4),
            "excerpt": _excerpt(item["text"]),
        }
        for item in results
    ]
    return compact_success(
        "Company document snippets found",
        {
            "query": query,
            "results": snippets,
            "citation_style": "Cite answers with filename and source location, for example: Employee Manual, p. 12.",
        },
    )


def _excerpt(value: str, limit: int = 900) -> str:
    normalized = " ".join(str(value or "").split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: limit - 3].rstrip()}..."
