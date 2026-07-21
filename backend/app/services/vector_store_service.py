"""
Qdrant vector store wrapper — one collection holding chunks from every
uploaded document, filterable by file_id.
"""

import os
import uuid
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "documents")
EMBEDDING_DIM = 3072

client = QdrantClient(url=QDRANT_URL)


def ensure_collection():
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in existing:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )


def upsert_chunks(file_id: str, filename: str, chunks: list[str], vectors: list[list[float]]):
    ensure_collection()
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={"file_id": file_id, "filename": filename, "chunk_index": idx, "text": chunk},
        )
        for idx, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]
    client.upsert(collection_name=COLLECTION_NAME, points=points)
    return len(points)


def search_similar(query_vector: list[float], top_k: int = 5, file_id: str | None = None):
    query_filter = None
    if file_id:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        query_filter = Filter(must=[FieldCondition(key="file_id", match=MatchValue(value=file_id))])

    results = client.search(
        collection_name=COLLECTION_NAME, query_vector=query_vector, limit=top_k, query_filter=query_filter,
    )
    return [{"text": r.payload["text"], "score": r.score, "filename": r.payload["filename"]} for r in results]
