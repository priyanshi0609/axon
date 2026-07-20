"""
Industrial AI Copilot endpoint — the conversational entry point that
fuses RAG (Qdrant) with the knowledge graph (networkx) before answering.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from app.services.rag_service import answer_query

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    question: str
    file_id: str | None = None
    top_k: int = 5


@router.post("/ask")
def ask(request: ChatRequest):
    return answer_query(request.question, top_k=request.top_k, file_id=request.file_id)
