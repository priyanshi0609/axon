"""
Lightweight knowledge graph store.

MVP DECISION: we use networkx + a JSON file on disk instead of running a
Neo4j instance. For a hackathon prototype this removes an entire piece of
infra (no extra docker container, no Cypher, nothing else to install) while
keeping the exact same node/relationship model. Swapping this module for a
Neo4j-backed one later is a same-shape change — see README "Scalability"
section for the migration plan; nothing above this module needs to change.
"""

import os
import json
import networkx as nx

GRAPH_DIR = "storage/graph"
GRAPH_FILE = os.path.join(GRAPH_DIR, "graph.json")
os.makedirs(GRAPH_DIR, exist_ok=True)

_graph = nx.DiGraph()


def _load():
    global _graph
    if os.path.exists(GRAPH_FILE):
        with open(GRAPH_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        _graph = nx.node_link_graph(data, directed=True)


def _save():
    with open(GRAPH_FILE, "w", encoding="utf-8") as f:
        json.dump(nx.node_link_data(_graph), f, ensure_ascii=False, indent=2)


_load()


def add_extraction(file_id: str, extraction: dict):
    """Merge one document's extracted entities/relationships into the graph.
    Nodes are keyed by their name so the same equipment mentioned across
    many documents collapses into a single node with multiple sources."""
    type_map = {
        "equipment": "Equipment", "personnel": "Person", "locations": "Location",
        "failures": "Failure", "regulations": "Regulation", "dates": "Date",
    }
    for key, node_type in type_map.items():
        for name in extraction.get(key, []):
            if not name:
                continue
            if _graph.has_node(name):
                _graph.nodes[name].setdefault("sources", [])
                if file_id not in _graph.nodes[name]["sources"]:
                    _graph.nodes[name]["sources"].append(file_id)
            else:
                _graph.add_node(name, type=node_type, sources=[file_id])

    for rel in extraction.get("relationships", []):
        src, tgt, relation = rel.get("source"), rel.get("target"), rel.get("relation")
        if src and tgt and relation:
            _graph.add_edge(src, tgt, relation=relation, file_id=file_id)

    _save()


def get_full_graph() -> dict:
    return nx.node_link_data(_graph)


def get_subgraph(entity_name: str, hops: int = 1) -> dict:
    """Return the neighbourhood around a node — used both by the graph
    view UI and by the RAG service to give the LLM relationship context."""
    if not _graph.has_node(entity_name):
        return {"nodes": [], "links": []}
    nodes = {entity_name}
    frontier = {entity_name}
    for _ in range(hops):
        next_frontier = set()
        for n in frontier:
            next_frontier |= set(_graph.predecessors(n)) | set(_graph.successors(n))
        nodes |= next_frontier
        frontier = next_frontier
    sub = _graph.subgraph(nodes)
    return nx.node_link_data(sub)


def search_nodes(query: str) -> list[str]:
    """Naive substring match over node names — good enough for a demo-scale
    graph (thousands of nodes). At production scale this becomes an index."""
    q = query.lower()
    return [n for n in _graph.nodes if q in n.lower()]


def stats() -> dict:
    return {
        "node_count": _graph.number_of_nodes(),
        "edge_count": _graph.number_of_edges(),
        "node_types": _count_by_type(),
    }


def _count_by_type() -> dict:
    counts: dict = {}
    for _, data in _graph.nodes(data=True):
        t = data.get("type", "Unknown")
        counts[t] = counts.get(t, 0) + 1
    return counts
