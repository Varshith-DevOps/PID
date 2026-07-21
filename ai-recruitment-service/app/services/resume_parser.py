import asyncio
import os
from pathlib import Path

SUPPORTED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}
SUPPORTED_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt"}


class ResumeParseError(Exception):
    pass


def validate_resume_metadata(file_name: str, mime_type: str | None, size_bytes: int, max_size_mb: int) -> None:
    ext = Path(file_name).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS or (mime_type and mime_type.lower() not in SUPPORTED_MIME_TYPES):
        raise ResumeParseError("UNSUPPORTED_RESUME_FORMAT")
    if size_bytes > max_size_mb * 1024 * 1024:
        raise ResumeParseError("RESUME_TOO_LARGE")


async def parse_resume_file(path: str, timeout_seconds: int = 20) -> str:
    async def _parse() -> str:
        suffix = Path(path).suffix.lower()
        if suffix == ".txt":
            return Path(path).read_text(encoding="utf-8", errors="ignore")
        try:
            from docling.document_converter import DocumentConverter

            result = DocumentConverter().convert(path)
            return result.document.export_to_markdown()
        except Exception as exc:  # pragma: no cover - covered by mocked tests
            raise ResumeParseError("RESUME_PARSE_FAILED") from exc

    if not os.path.exists(path):
        raise ResumeParseError("RESUME_NOT_FOUND")
    try:
        return await asyncio.wait_for(_parse(), timeout=timeout_seconds)
    except asyncio.TimeoutError as exc:
        raise ResumeParseError("RESUME_PARSE_FAILED") from exc
