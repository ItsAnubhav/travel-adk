from __future__ import annotations

from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.config import get_settings
from app.core.rag import cleanup_temp_file, persist_upload_to_temp, rag_store

router = APIRouter(prefix="/rag", tags=["rag"])


class RagDocumentResponse(BaseModel):
    id: str
    company_id: str
    filename: str
    file_type: str
    content_type: str = ""
    status: str
    source_count: int = 0
    chunk_count: int = 0
    error_message: str | None = None
    uploaded_by: str = ""
    created_at: str
    updated_at: str


class RagDocumentListResponse(BaseModel):
    documents: list[RagDocumentResponse] = Field(default_factory=list)


class RagDeleteResponse(BaseModel):
    ok: bool


@router.post("/documents", response_model=RagDocumentResponse)
async def upload_document(
    companyId: str = Form(...),
    uploadedBy: str = Form(""),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    settings = get_settings()
    content = await file.read()
    max_bytes = max(settings.rag_max_upload_mb, 1) * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File is too large. Maximum upload size is {settings.rag_max_upload_mb} MB.",
        )

    temp_path = await persist_upload_to_temp(file.filename or "upload", content)
    try:
        document = await rag_store.index_file(
            path=temp_path,
            filename=file.filename or "upload",
            content_type=file.content_type or "",
            company_id=companyId.strip(),
            uploaded_by=uploadedBy.strip(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        cleanup_temp_file(temp_path)

    return document


@router.get("/documents", response_model=RagDocumentListResponse)
async def list_documents(companyId: str) -> dict[str, Any]:
    if not companyId.strip():
        raise HTTPException(status_code=400, detail="companyId is required")
    return {"documents": await rag_store.list_documents(companyId.strip())}


@router.delete("/documents/{document_id}", response_model=RagDeleteResponse)
async def delete_document(document_id: str, companyId: str) -> dict[str, bool]:
    if not companyId.strip():
        raise HTTPException(status_code=400, detail="companyId is required")
    deleted = await rag_store.delete_document(document_id=document_id, company_id=companyId.strip())
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"ok": True}
