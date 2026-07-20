"""
Knowledge Graph Agent endpoints — build the graph from a processed
document, and read it back for the graph visualization UI.
"""

import os
import json
from fastapi import APIRouter, HTTPException
from app.services.entity_extraction_service import extract_entities
from app.services import graph_service

router = APIRouter(prefix="/graph", tags=["graph"])

EXTRACTED_DIR = "storage/extracted"


@router.post("/extract/{file_id}")
def extract_and_build(file_id: str):
    extracted_path = os.path.join(EXTRACTED_DIR, f"{file_id}.json")
    if not os.path.exists(extracted_path):
        raise HTTPException(status_code=404, detail="Document not processed yet. Run /process first.")

    with open(extracted_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    extraction = extract_entities(data["text"])
    graph_service.add_extraction(file_id, extraction)

    return {
        "file_id": file_id,
        "entities_added": {k: len(v) for k, v in extraction.items() if k != "relationships"},
        "relationships_added": len(extraction.get("relationships", [])),
        "status": "graph_updated",
    }


@router.get("/full")
def full_graph():
    return graph_service.get_full_graph()


@router.get("/node/{entity_name}")
def node_neighbourhood(entity_name: str, hops: int = 1):
    result = graph_service.get_subgraph(entity_name, hops=hops)
    if not result["nodes"]:
        raise HTTPException(status_code=404, detail="Entity not found in graph")
    return result


@router.get("/search")
def search(q: str):
    return {"query": q, "matches": graph_service.search_nodes(q)}
