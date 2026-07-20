"""
Universal Document Upload — accepts any supported industrial document
type, validates it, and stores it under a UUID so the rest of the
pipeline never has to deal with messy original filenames.
"""

import os
import uuid
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_DIR = "storage/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".xlsx", ".xls",
    ".docx", ".doc", ".pptx", ".ppt", ".csv", ".txt", ".eml"
}

MAX_FILE_SIZE_MB = 25


def is_allowed_file(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS


@router.post("/")
async def upload_document(file: UploadFile = File(...)):
    if not is_allowed_file(file.filename):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.filename}")

    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=400, detail="File exceeds 25MB limit")

    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    stored_filename = f"{file_id}{ext}"
    file_path = os.path.join(UPLOAD_DIR, stored_filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    metadata = {
        "file_id": file_id,
        "original_filename": file.filename,
        "stored_filename": stored_filename,
        "content_type": file.content_type,
        "size_mb": round(size_mb, 3),
        "uploaded_at": datetime.utcnow().isoformat(),
        "status": "uploaded",
    }
    return JSONResponse(content=metadata)


@router.post("/batch")
async def upload_multiple_documents(files: list[UploadFile] = File(...)):
    results, errors = [], []
    for file in files:
        try:
            result = await upload_document(file)
            results.append(result.body)
        except HTTPException as e:
            errors.append({"filename": file.filename, "error": e.detail})
    return {"uploaded": len(results), "failed": len(errors), "errors": errors}
