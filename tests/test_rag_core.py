from pathlib import Path

import pytest

from app.core.rag import _supported_file_type, chunk_sources, extract_sources


def test_txt_extraction_and_chunking_preserves_source_location(tmp_path: Path) -> None:
    path = tmp_path / "policy.txt"
    path.write_text(("Leave policy allows planned leave with manager approval. " * 80).strip())

    sources = extract_sources(str(path), path.name, "txt")
    chunks = chunk_sources(sources)

    assert sources[0].location == "text"
    assert chunks
    assert chunks[0].source_location == "text"
    assert "Leave policy" in chunks[0].text


def test_rejects_legacy_doc_files() -> None:
    with pytest.raises(ValueError, match="Legacy .doc files are not supported"):
        _supported_file_type("manual.doc", "application/msword")


def test_empty_txt_file_reports_no_extractable_text(tmp_path: Path) -> None:
    path = tmp_path / "empty.txt"
    path.write_text("")

    with pytest.raises(ValueError, match="No extractable text"):
        extract_sources(str(path), path.name, "txt")
