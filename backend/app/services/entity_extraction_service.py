"""
Turns raw extracted document text into structured entities + relationships.
This is what feeds the Knowledge Graph — the piece that separates Axon
from a plain RAG-over-PDFs chatbot.
"""

from app.services.llm_service import generate_json

SYSTEM_INSTRUCTION = """You are an industrial document analyst. You read
maintenance, engineering, safety and compliance text and extract structured
facts. You never invent equipment tags, dates or names that are not present
or clearly implied in the text. If a field has nothing to extract, return an
empty list for it."""

EXTRACTION_PROMPT_TEMPLATE = """Extract structured industrial knowledge from
the document text below. Return ONLY valid JSON, no prose, no markdown
fences, matching exactly this shape:

{{
  "equipment": ["Pump P204", "Boiler 4"],
  "personnel": ["Ravi Kumar"],
  "locations": ["Plant B", "Unit 3"],
  "failures": ["Bearing damage", "Overheating"],
  "regulations": ["OISD-STD-105"],
  "dates": ["2022-04-11"],
  "relationships": [
    {{"source": "Pump P204", "relation": "INSTALLED_IN", "target": "Boiler 4"}},
    {{"source": "Pump P204", "relation": "HAD_FAILURE", "target": "Bearing damage"}},
    {{"source": "Bearing damage", "relation": "OCCURRED_ON", "target": "2022-04-11"}},
    {{"source": "Ravi Kumar", "relation": "INSPECTED", "target": "Pump P204"}}
  ]
}}

Document text (truncated to fit context window):
---
{text}
---
"""


def extract_entities(text: str, max_chars: int = 12000) -> dict:
    """Run entity + relationship extraction on a chunk of document text.
    Text is truncated defensively so a single huge document doesn't blow
    the model's context window — for very large docs the caller should
    chunk and call this per-chunk, then merge results in graph_service."""
    truncated = text[:max_chars]
    prompt = EXTRACTION_PROMPT_TEMPLATE.format(text=truncated)
    data = generate_json(prompt, system_instruction=SYSTEM_INSTRUCTION)

    # Defensive defaults so a partial LLM response never crashes the graph build
    for key in ["equipment", "personnel", "locations", "failures", "regulations", "dates"]:
        data.setdefault(key, [])
    data.setdefault("relationships", [])
    return data
