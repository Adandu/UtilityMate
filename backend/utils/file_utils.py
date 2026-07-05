import hashlib
import os
import re
import unicodedata
from pathlib import Path
from typing import Callable, Iterable, Optional, Tuple

from fastapi import HTTPException, UploadFile

_filename_ascii_strip_re = re.compile(r"[^A-Za-z0-9_.-]")
_windows_device_files = (
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
)


def secure_filename(filename: str) -> str:
    """
    Sanitize a filename to ensure it is safe to use for storage on the filesystem.
    Inspired by Werkzeug's secure_filename.
    """
    if isinstance(filename, str):
        filename = (
            unicodedata.normalize("NFKD", filename)
            .encode("ascii", "ignore")
            .decode("ascii")
        )

    for sep in os.path.sep, os.path.altsep:
        if sep:
            filename = filename.replace(sep, " ")

    filename = str(_filename_ascii_strip_re.sub("_", "_".join(filename.split())))

    # Reduce multiple underscores to a single one
    filename = re.sub(r"_+", "_", filename)

    filename = filename.strip("._")

    if (
        os.name == "nt"
        and filename
        and filename.split(".")[0].upper() in _windows_device_files
    ):
        filename = f"_{filename}"

    return filename


async def read_upload_file_limited(file: UploadFile, max_size: int) -> bytes:
    """
    Read an uploaded file with an enforced byte limit.

    Starlette may already spool uploads to disk, but reading through a bounded loop
    prevents accidentally accepting oversized files in endpoints with custom limits.
    """
    chunks: list[bytes] = []
    total_size = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large ({total_size // 1024}KB). Max {max_size // (1024 * 1024)}MB.",
            )
        chunks.append(chunk)
    return b"".join(chunks)


async def save_and_validate_upload(
    file: UploadFile,
    upload_dir: str,
    allowed_extensions: Iterable[str],
    max_size: int,
    filename_builder: Optional[Callable[[str, str], str]] = None,
    invalid_extension_detail: str = "Only PDF files are allowed",
    invalid_content_detail: str = "Invalid PDF file content",
) -> Tuple[Path, bytes, str]:
    """
    Shared upload scaffolding used by the invoice and association-statement upload
    endpoints: sanitize the filename, enforce the extension allow-list, read the
    body with a size limit, verify the PDF magic bytes, hash the content, and
    write it to disk.

    Raises HTTPException(400) for a disallowed extension or invalid PDF content,
    and propagates HTTPException(413) from read_upload_file_limited for oversized
    uploads. Callers that need to dedupe by content hash against the database
    should do so right after calling this helper (using the returned hash/path)
    and remove the just-written file if it turns out to be a duplicate - the hash
    can only be computed after the body has been read, so this helper cannot
    perform that check itself without knowing the caller's model/query.

    `filename_builder(file_hash, ext) -> str` controls the on-disk filename;
    defaults to `f"{file_hash}{ext}"` when not provided.

    Returns (file_path, raw_content, sha256_hash).
    """
    safe_filename = secure_filename(file.filename)
    ext = os.path.splitext(safe_filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=invalid_extension_detail)

    content = await read_upload_file_limited(file, max_size)

    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail=invalid_content_detail)

    file_hash = hashlib.sha256(content).hexdigest()
    unique_filename = filename_builder(file_hash, ext) if filename_builder else f"{file_hash}{ext}"
    file_path = Path(upload_dir) / unique_filename

    with open(file_path, "wb") as buffer:
        buffer.write(content)

    return file_path, content, file_hash
