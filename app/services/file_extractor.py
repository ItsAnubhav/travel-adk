"""
Generic text extraction across file types.

Image / PDF / DOCX / TXT / audio go through one entry point: ``extract_text``.
Audio is transcribed via Whisper; images are described + OCR'd by a vision
LLM; PDFs use PyMuPDF; DOCX uses python-docx; plain text is read as-is.

The returned ``ExtractedFile`` is the same shape for every kind of input,
so callers can index it uniformly into the vector store.
"""
from __future__ import annotations

import base64
import logging
import mimetypes
import os
from dataclasses import dataclass, field
from typing import Optional

from litellm import acompletion, atranscription

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
_PDF_EXTS = {".pdf"}
_DOCX_EXTS = {".docx"}
_TEXT_EXTS = {".txt", ".md", ".csv", ".log", ".json", ".yaml", ".yml", ".html", ".xml"}
_AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".webm", ".ogg", ".flac", ".mp4"}

_MAX_TEXT_CHARS = 50_000


@dataclass
class ExtractedFile:
    """Normalized result of running text extraction on an uploaded file."""

    file_path: str
    filename: str
    kind: str
    mime_type: Optional[str] = None
    text: str = ""
    summary: str = ""
    error: Optional[str] = None
    extras: dict = field(default_factory=dict)


def classify(path: str) -> str:
    """Return a short kind label (``image``/``pdf``/``audio``/``docx``/``text``/``unknown``)."""
    ext = os.path.splitext(path)[1].lower()
    if ext in _IMAGE_EXTS:
        return "image"
    if ext in _PDF_EXTS:
        return "pdf"
    if ext in _DOCX_EXTS:
        return "docx"
    if ext in _AUDIO_EXTS:
        return "audio"
    if ext in _TEXT_EXTS:
        return "text"
    return "unknown"


async def extract_text(file_path: str) -> ExtractedFile:
    """Run the right extractor for ``file_path`` and return a normalized result."""
    filename = os.path.basename(file_path)
    mime_type, _ = mimetypes.guess_type(file_path)
    kind = classify(file_path)
    result = ExtractedFile(file_path=file_path, filename=filename, kind=kind, mime_type=mime_type)

    if not os.path.exists(file_path):
        result.error = f"File not found: {file_path}"
        return result

    try:
        if kind == "image":
            await _extract_image(file_path, result)
        elif kind == "pdf":
            _extract_pdf(file_path, result)
        elif kind == "docx":
            _extract_docx(file_path, result)
        elif kind == "audio":
            await _extract_audio(file_path, result)
        elif kind == "text":
            _extract_plain_text(file_path, result)
        else:
            result.error = f"Unsupported file type: {os.path.splitext(file_path)[1]}"
    except Exception as exc:
        logger.exception("file_extractor failed for %s", file_path)
        result.error = str(exc)

    if result.text and len(result.text) > _MAX_TEXT_CHARS:
        result.text = result.text[:_MAX_TEXT_CHARS]
        result.extras["truncated"] = True
    if result.text and not result.summary:
        result.summary = result.text[:280].strip()
    return result


def _extract_pdf(path: str, result: ExtractedFile) -> None:
    import fitz

    parts: list[str] = []
    with fitz.open(path) as doc:
        for page in doc:
            parts.append(page.get_text())
            if sum(len(p) for p in parts) > _MAX_TEXT_CHARS:
                break
    result.text = "\n".join(parts).strip()
    result.extras["pages"] = doc.page_count if hasattr(doc, "page_count") else len(parts)


def _extract_docx(path: str, result: ExtractedFile) -> None:
    from docx import Document

    doc = Document(path)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    result.text = "\n".join(paragraphs).strip()
    result.extras["paragraphs"] = len(paragraphs)


def _extract_plain_text(path: str, result: ExtractedFile) -> None:
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        result.text = fh.read().strip()


async def _extract_image(path: str, result: ExtractedFile) -> None:
    with open(path, "rb") as fh:
        b64 = base64.b64encode(fh.read()).decode("utf-8")
    ext = os.path.splitext(path)[1].lower().lstrip(".") or "png"
    response = await acompletion(
        model=settings.effective_llm_model,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Describe this image in 2-3 sentences, then list any text "
                            "visible in the image verbatim. Respond as plain text with "
                            "two sections labelled 'Description:' and 'Text:'."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/{ext};base64,{b64}"},
                    },
                ],
            }
        ],
    )
    content = (response.choices[0].message.content or "").strip()
    result.text = content
    result.summary = content.split("\n", 1)[0].strip()[:280]


async def _extract_audio(path: str, result: ExtractedFile) -> None:
    with open(path, "rb") as fh:
        response = await atranscription(
            model="groq/whisper-large-v3",
            file=fh,
        )
    text = ""
    if isinstance(response, dict):
        text = response.get("text") or ""
    else:
        text = getattr(response, "text", "") or ""
    result.text = text.strip()
    result.extras["duration_estimate_chars"] = len(text)
