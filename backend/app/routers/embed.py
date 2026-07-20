"""
Embedding + semantic search endpoints, backed by Qdrant.
"""

import os
import json
from fastapi import APIRouter, HTTPException
from app.services.chunking_service import chunk_text
from app.services.embedding_service import embed_texts, embed_query
from app.services.vector_store_service import upsert_chunks, search_similar

router = APIRouter(prefix="/embed", tags=["embed"])

EXTRACTED_DIR = "storage/extracted"


@router.post("/{file_id}")
def embed_document(file_id: str):
    extracted_path = os.path.join(EXTRACTED_DIR, f"{file_id}.json")
    if not os.path.exists(extracted_path):
        raise HTTPException(status_code=404, detail="Document not processed yet. Run /process first.")

    with open(extracted_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    chunks = chunk_text(data["text"])
    if not chunks:
        raise HTTPException(status_code=400, detail="No text found to embed.")

    vectors = embed_texts(chunks)
    count = upsert_chunks(file_id=file_id, filename=file_id, chunks=chunks, vectors=vectors)

    return {"file_id": file_id, "chunks_created": count, "status": "embedded"}


@router.get("/search")
def search_documents(query: str, top_k: int = 5, file_id: str | None = None):
    query_vector = embed_query(query)
    results = search_similar(query_vector, top_k=top_k, file_id=file_id)
    return {"query": query, "results": results}
