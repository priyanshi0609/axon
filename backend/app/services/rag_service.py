"""
Reasoning layer that fuses vector search (Qdrant) with graph context
(networkx) before asking the LLM to answer. This is the "Reasoning Agent"
from the pitch deck, implemented as a straightforward function rather than
a heavyweight agent framework — fewer moving parts, same behaviour for a
hackathon-scale corpus.
"""

from app.services.embedding_service import embed_query
from app.services.vector_store_service import search_similar
from app.services.graph_service import search_nodes, get_subgraph
from app.services.llm_service import generate_text

SYSTEM_INSTRUCTION = """You are Axon, an industrial knowledge assistant.
Answer using ONLY the provided context (document excerpts and knowledge
graph relationships). If the context does not contain the answer, say so
plainly instead of guessing. Always end with a short "Suggested action"
line when the question is operational (maintenance, safety, compliance)."""

ANSWER_PROMPT_TEMPLATE = """Question: {question}

Relevant document excerpts:
{doc_context}

Relevant knowledge graph relationships:
{graph_context}

Write a concise, decision-ready answer grounded only in the context above.
"""


def _format_doc_context(results: list[dict]) -> str:
    if not results:
        return "(no matching documents found)"
    lines = []
    for r in results:
        lines.append(f"- [{r['filename']}, score={r['score']:.2f}] {r['text'][:400]}")
    return "\n".join(lines)


def _format_graph_context(entity_names: list[str]) -> str:
    lines = []
    for name in entity_names[:5]:
        sub = get_subgraph(name, hops=1)
        for link in sub.get("links", []):
            lines.append(f"- {link['source']} --{link['relation']}--> {link['target']}")
    return "\n".join(lines) if lines else "(no matching graph entities found)"


def answer_query(question: str, top_k: int = 5, file_id: str | None = None) -> dict:
    query_vector = embed_query(question)
    doc_results = search_similar(query_vector, top_k=top_k, file_id=file_id)

    matched_entities = search_nodes(question)
    graph_context = _format_graph_context(matched_entities)

    prompt = ANSWER_PROMPT_TEMPLATE.format(
        question=question,
        doc_context=_format_doc_context(doc_results),
        graph_context=graph_context,
    )
    answer_text = generate_text(prompt, system_instruction=SYSTEM_INSTRUCTION)

    top_score = doc_results[0]["score"] if doc_results else 0.0
    confidence = "high" if top_score > 0.75 else "medium" if top_score > 0.5 else "low"

    return {
        "question": question,
        "answer": answer_text,
        "confidence": confidence,
        "sources": [{"filename": r["filename"], "score": round(r["score"], 3)} for r in doc_results],
        "graph_entities_used": matched_entities[:5],
    }
