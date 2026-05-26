from __future__ import annotations

import logging
import math
import os
import re
import tempfile
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, DateTime, ForeignKey, Integer, MetaData, String, Table, Text, delete, select, text, update
from sqlalchemy.dialects.postgresql import JSONB, insert
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings

logger = logging.getLogger(__name__)

SUPPORTED_RAG_EXTENSIONS = {".pdf", ".txt", ".docx"}
SUPPORTED_RAG_CONTENT_TYPES = {
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
CHUNK_TARGET_CHARS = 1400
CHUNK_OVERLAP_CHARS = 220


def _now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True)
class SourceText:
    location: str
    text: str


@dataclass(frozen=True)
class RagChunk:
    source_location: str
    chunk_index: int
    text: str
    metadata: dict[str, Any]


class RagStore:
    def __init__(self) -> None:
        settings = get_settings()
        self._settings = settings
        self._engine = create_async_engine(settings.database_url, future=True)
        self._metadata = MetaData()
        vector_dimension = settings.rag_embedding_dimension

        self.documents = Table(
            "rag_documents",
            self._metadata,
            Column("id", String, primary_key=True),
            Column("company_id", String, nullable=False, index=True),
            Column("filename", String, nullable=False),
            Column("file_type", String, nullable=False),
            Column("content_type", String, nullable=False, default=""),
            Column("status", String, nullable=False, default="indexing"),
            Column("source_count", Integer, nullable=False, default=0),
            Column("chunk_count", Integer, nullable=False, default=0),
            Column("error_message", Text),
            Column("uploaded_by", String, nullable=False, default=""),
            Column("created_at", DateTime(timezone=True), nullable=False),
            Column("updated_at", DateTime(timezone=True), nullable=False),
        )
        self.chunks = Table(
            "rag_chunks",
            self._metadata,
            Column("id", String, primary_key=True),
            Column("document_id", String, ForeignKey("rag_documents.id", ondelete="CASCADE"), nullable=False, index=True),
            Column("company_id", String, nullable=False, index=True),
            Column("source_location", String, nullable=False, default=""),
            Column("chunk_index", Integer, nullable=False),
            Column("text", Text, nullable=False),
            Column("chunk_metadata", JSONB, nullable=False, default=dict),
            Column("embedding", Vector(vector_dimension), nullable=False),
            Column("created_at", DateTime(timezone=True), nullable=False),
        )

    async def initialize(self) -> None:
        try:
            async with self._engine.begin() as connection:
                await connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                await connection.run_sync(self._metadata.create_all)
                await connection.execute(
                    text("CREATE INDEX IF NOT EXISTS rag_chunks_company_document_idx ON rag_chunks (company_id, document_id)")
                )
            try:
                async with self._engine.begin() as connection:
                    await connection.execute(
                        text(
                            "CREATE INDEX IF NOT EXISTS rag_chunks_embedding_hnsw_idx "
                            "ON rag_chunks USING hnsw (embedding vector_cosine_ops)"
                        )
                    )
            except Exception:
                logger.warning("HNSW pgvector index creation failed; falling back to IVFFlat", exc_info=True)
                async with self._engine.begin() as connection:
                    await connection.execute(
                        text(
                            "CREATE INDEX IF NOT EXISTS rag_chunks_embedding_ivfflat_idx "
                            "ON rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
                        )
                    )
        except Exception:
            logger.exception("RAG database initialization failed")
            raise

    async def index_file(
        self,
        *,
        path: str,
        filename: str,
        content_type: str,
        company_id: str,
        uploaded_by: str = "",
    ) -> dict[str, Any]:
        if not company_id.strip():
            raise ValueError("companyId is required")

        file_type = _supported_file_type(filename, content_type)
        document_id = str(uuid.uuid4())
        now = _now()
        await self._insert_document(
            {
                "id": document_id,
                "company_id": company_id,
                "filename": filename,
                "file_type": file_type,
                "content_type": content_type or "",
                "status": "indexing",
                "source_count": 0,
                "chunk_count": 0,
                "error_message": None,
                "uploaded_by": uploaded_by or "",
                "created_at": now,
                "updated_at": now,
            }
        )

        try:
            sources = extract_sources(path, filename, file_type)
            chunks = chunk_sources(sources)
            if not chunks:
                raise ValueError("No extractable text found. Only text-based PDFs, TXT, and DOCX files are supported.")

            embeddings = await embed_texts([chunk.text for chunk in chunks])
            rows = []
            created_at = _now()
            for chunk, embedding in zip(chunks, embeddings, strict=True):
                rows.append(
                    {
                        "id": str(uuid.uuid4()),
                        "document_id": document_id,
                        "company_id": company_id,
                        "source_location": chunk.source_location,
                        "chunk_index": chunk.chunk_index,
                        "text": chunk.text,
                        "chunk_metadata": chunk.metadata,
                        "embedding": embedding,
                        "created_at": created_at,
                    }
                )

            async with self._engine.begin() as connection:
                await connection.execute(insert(self.chunks), rows)
                await connection.execute(
                    update(self.documents)
                    .where(self.documents.c.id == document_id)
                    .values(
                        status="indexed",
                        source_count=len(sources),
                        chunk_count=len(rows),
                        updated_at=_now(),
                    )
                )
            document = await self.get_document(document_id)
            return document or {"id": document_id, "status": "indexed", "chunk_count": len(rows)}
        except Exception as exc:
            message = str(exc)
            async with self._engine.begin() as connection:
                await connection.execute(delete(self.chunks).where(self.chunks.c.document_id == document_id))
                await connection.execute(
                    update(self.documents)
                    .where(self.documents.c.id == document_id)
                    .values(status="failed", error_message=message[:2000], updated_at=_now())
                )
            logger.exception("RAG indexing failed for %s", filename)
            document = await self.get_document(document_id)
            return document or {"id": document_id, "status": "failed", "error_message": message}

    async def list_documents(self, company_id: str) -> list[dict[str, Any]]:
        async with self._engine.begin() as connection:
            rows = (
                await connection.execute(
                    select(self.documents)
                    .where(self.documents.c.company_id == company_id)
                    .order_by(self.documents.c.created_at.desc())
                )
            ).mappings().all()
        return [self._serialize(dict(row)) for row in rows]

    async def get_document(self, document_id: str) -> dict[str, Any] | None:
        async with self._engine.begin() as connection:
            row = (
                await connection.execute(select(self.documents).where(self.documents.c.id == document_id))
            ).mappings().first()
        return self._serialize(dict(row)) if row else None

    async def delete_document(self, *, document_id: str, company_id: str) -> bool:
        async with self._engine.begin() as connection:
            row = (
                await connection.execute(
                    select(self.documents.c.id).where(
                        self.documents.c.id == document_id,
                        self.documents.c.company_id == company_id,
                    )
                )
            ).first()
            if row is None:
                return False
            await connection.execute(delete(self.chunks).where(self.chunks.c.document_id == document_id))
            await connection.execute(delete(self.documents).where(self.documents.c.id == document_id))
        return True

    async def search(self, *, company_id: str, query: str, top_k: int | None = None) -> list[dict[str, Any]]:
        query = query.strip()
        if not company_id.strip() or not query:
            return []
        limit = max(1, min(top_k or self._settings.rag_top_k, 10))
        query_embedding = (await embed_texts([query]))[0]
        distance = self.chunks.c.embedding.cosine_distance(query_embedding).label("distance")
        stmt = (
            select(
                self.chunks.c.document_id,
                self.chunks.c.source_location,
                self.chunks.c.chunk_index,
                self.chunks.c.text,
                self.chunks.c.chunk_metadata,
                self.documents.c.filename,
                distance,
            )
            .join(self.documents, self.documents.c.id == self.chunks.c.document_id)
            .where(
                self.chunks.c.company_id == company_id,
                self.documents.c.status == "indexed",
            )
            .order_by(distance)
            .limit(limit)
        )
        async with self._engine.begin() as connection:
            rows = (await connection.execute(stmt)).mappings().all()
        results = []
        for row in rows:
            distance_value = float(row["distance"] or 0)
            results.append(
                {
                    "document_id": row["document_id"],
                    "filename": row["filename"],
                    "source_location": row["source_location"],
                    "chunk_index": row["chunk_index"],
                    "text": row["text"],
                    "metadata": row["chunk_metadata"] or {},
                    "score": max(0.0, 1.0 - distance_value),
                }
            )
        return results

    async def _insert_document(self, values: dict[str, Any]) -> None:
        async with self._engine.begin() as connection:
            await connection.execute(insert(self.documents).values(**values))

    def _serialize(self, value: dict[str, Any]) -> dict[str, Any]:
        for key, item in list(value.items()):
            if isinstance(item, datetime):
                value[key] = item.isoformat()
        return value


def _supported_file_type(filename: str, content_type: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext == ".doc":
        raise ValueError("Legacy .doc files are not supported. Please upload DOCX, TXT, or a text-based PDF.")
    if ext not in SUPPORTED_RAG_EXTENSIONS and content_type not in SUPPORTED_RAG_CONTENT_TYPES:
        raise ValueError("Unsupported file type. Upload PDF, TXT, or DOCX.")
    if ext == ".pdf" or content_type == "application/pdf":
        return "pdf"
    if ext == ".docx" or content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return "docx"
    return "txt"


def extract_sources(path: str, filename: str, file_type: str) -> list[SourceText]:
    if file_type == "pdf":
        return _extract_pdf_sources(path)
    if file_type == "docx":
        return _extract_docx_sources(path)
    if file_type == "txt":
        return _extract_txt_sources(path)
    raise ValueError(f"Unsupported file type for {filename}")


def _extract_pdf_sources(path: str) -> list[SourceText]:
    import fitz

    sources: list[SourceText] = []
    with fitz.open(path) as doc:
        for index, page in enumerate(doc, start=1):
            text_value = page.get_text("text").strip()
            if text_value:
                sources.append(SourceText(location=f"p. {index}", text=text_value))
    if not sources:
        raise ValueError("No extractable text found. Only text-based PDFs are supported; scanned/image PDFs are not supported yet.")
    return sources


def _extract_docx_sources(path: str) -> list[SourceText]:
    from docx import Document

    doc = Document(path)
    paragraphs = [paragraph.text.strip() for paragraph in doc.paragraphs if paragraph.text.strip()]
    if not paragraphs:
        raise ValueError("No extractable text found in DOCX file.")
    sections: list[SourceText] = []
    buffer: list[str] = []
    section_index = 1
    for paragraph in paragraphs:
        if sum(len(item) for item in buffer) + len(paragraph) > 2200 and buffer:
            sections.append(SourceText(location=f"section {section_index}", text="\n".join(buffer)))
            section_index += 1
            buffer = []
        buffer.append(paragraph)
    if buffer:
        sections.append(SourceText(location=f"section {section_index}", text="\n".join(buffer)))
    return sections


def _extract_txt_sources(path: str) -> list[SourceText]:
    text_value = Path(path).read_text(encoding="utf-8", errors="replace").strip()
    if not text_value:
        raise ValueError("No extractable text found in TXT file.")
    return [SourceText(location="text", text=text_value)]


def chunk_sources(sources: list[SourceText]) -> list[RagChunk]:
    chunks: list[RagChunk] = []
    for source in sources:
        normalized = _normalize_text(source.text)
        if not normalized:
            continue
        start = 0
        local_index = 0
        while start < len(normalized):
            end = min(len(normalized), start + CHUNK_TARGET_CHARS)
            if end < len(normalized):
                boundary = max(normalized.rfind("\n", start, end), normalized.rfind(". ", start, end))
                if boundary > start + 500:
                    end = boundary + 1
            text_value = normalized[start:end].strip()
            if text_value:
                chunks.append(
                    RagChunk(
                        source_location=source.location,
                        chunk_index=len(chunks),
                        text=text_value,
                        metadata={
                            "source_location": source.location,
                            "local_chunk_index": local_index,
                            "char_start": start,
                            "char_end": end,
                        },
                    )
                )
                local_index += 1
            if end >= len(normalized):
                break
            start = max(end - CHUNK_OVERLAP_CHARS, start + 1)
    return chunks


async def embed_texts(texts: list[str]) -> list[list[float]]:
    settings = get_settings()
    cleaned = [text_value.strip() for text_value in texts if text_value.strip()]
    if not cleaned:
        return []

    api_key = settings.openai_api_key.strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY is required for RAG embeddings")

    model = _openai_embedding_model(settings.rag_embedding_model)
    payload = {"model": model, "input": cleaned}
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "curl/8.7.1",
    }
    async with httpx.AsyncClient(timeout=60.0, trust_env=False, http2=False) as client:
        response = await client.post("https://api.openai.com/v1/embeddings", headers=headers, json=payload)
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = response.text[:1000]
        raise ValueError(f"Embedding request failed with status {response.status_code}: {detail}") from exc

    data = response.json().get("data")
    embeddings: list[list[float]] = []
    for item in data or []:
        embedding = item.get("embedding") if isinstance(item, dict) else getattr(item, "embedding", None)
        if not embedding:
            continue
        vector = [float(value) for value in embedding]
        if len(vector) != settings.rag_embedding_dimension:
            raise ValueError(
                f"Embedding dimension {len(vector)} does not match RAG_EMBEDDING_DIMENSION={settings.rag_embedding_dimension}"
            )
        if any(math.isnan(value) or math.isinf(value) for value in vector):
            raise ValueError("Embedding response contained invalid numeric values")
        embeddings.append(vector)
    if len(embeddings) != len(cleaned):
        raise ValueError("Embedding service returned an unexpected number of vectors")
    return embeddings


def _openai_embedding_model(model: str) -> str:
    model = model.strip()
    if model.startswith("openai/"):
        return model.split("/", 1)[1]
    return model


def _normalize_text(value: str) -> str:
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


async def persist_upload_to_temp(filename: str, content: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    handle = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, prefix="rag-upload-")
    try:
        handle.write(content)
        return handle.name
    finally:
        handle.close()


def cleanup_temp_file(path: str) -> None:
    try:
        os.unlink(path)
    except FileNotFoundError:
        return
    except Exception:
        logger.warning("Failed to clean up temp RAG upload %s", path)


rag_store = RagStore()
