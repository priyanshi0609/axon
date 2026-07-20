"""
Token-aware text chunking with overlap, used before embedding.
"""

import tiktoken

encoding = tiktoken.get_encoding("cl100k_base")

CHUNK_SIZE = 500
CHUNK_OVERLAP = 75


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    if not text.strip():
        return []

    tokens = encoding.encode(text)
    chunks = []
    start = 0
    while start < len(tokens):
        end = start + chunk_size
        chunk_tokens = tokens[start:end]
        chunks.append(encoding.decode(chunk_tokens).strip())
        if end >= len(tokens):
            break
        start = end - overlap
    return chunks
