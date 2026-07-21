"""
Gemini embedding wrapper, used for both document chunks and user queries.
"""
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 3072


def embed_texts(texts: list[str]) -> list[list[float]]:

    embeddings = []

    for text in texts:

        response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=text,
        )

        embeddings.append(response.embeddings[0].values)

    return embeddings


def embed_query(text: str) -> list[float]:

    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
    )

    return response.embeddings[0].values