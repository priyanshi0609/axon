"""
Gemini embedding wrapper, used for both document chunks and user queries.
"""

import os
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

EMBEDDING_MODEL = "models/text-embedding-004"
EMBEDDING_DIM = 768


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    embeddings = []
    for text in texts:
        result = genai.embed_content(
            model=EMBEDDING_MODEL, content=text, task_type="retrieval_document",
        )
        embeddings.append(result["embedding"])
    return embeddings


def embed_query(text: str) -> list[float]:
    result = genai.embed_content(
        model=EMBEDDING_MODEL, content=text, task_type="retrieval_query",
    )
    return result["embedding"]
