"""
Document Processing Agent — runs OCR / text extraction and caches the
result to disk so re-querying a document never re-does expensive OCR.
"""

import os
import glob
import json
from fastapi import APIRouter, HTTPException
from app.services.ocr_service import extract_text

router = APIRouter(prefix="/process", tags=["process"])

UPLOAD_DIR = "storage/uploads"
EXTRACTED_DIR = "storage/extracted"
os.makedirs(EXTRACTED_DIR, exist_ok=True)


def find_uploaded_file(file_id: str) -> str:
    matches = glob.glob(os.path.join(UPLOAD_DIR, f"{file_id}.*"))
    if not matches:
        raise HTTPException(status_code=404, detail="File not found")
    return matches[0]


@router.post("/{file_id}")
def process_document(file_id: str):
    file_path = find_uploaded_file(file_id)
    try:
        result = extract_text(file_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

    output_path = os.path.join(EXTRACTED_DIR, f"{file_id}.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    return {
        "file_id": file_id,
        "pages": result["pages"],
        "ocr_used": result["ocr_used"],
        "char_count": len(result["text"]),
        "preview": result["text"][:500],
        "status": "processed",
    }


@router.get("/{file_id}")
def get_processed_text(file_id: str):
    output_path = os.path.join(EXTRACTED_DIR, f"{file_id}.json")
    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Not processed yet")
    with open(output_path, "r", encoding="utf-8") as f:
        return json.load(f)
