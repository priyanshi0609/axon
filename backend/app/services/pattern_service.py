"""
Failure Pattern Engine — Axon's headline differentiator.

Instead of a black-box ML model, this reads the knowledge graph's
HAD_FAILURE edges (grounded in real inspection/maintenance documents,
each traceable back to a source file) and looks for regularly recurring
failures on the same equipment. If an equipment node has failed 2+ times
with a fairly consistent interval, we surface a predicted next-failure
window with the evidence trail attached. Fully explainable — every number
in the output traces back to a document.
"""

import statistics
from datetime import datetime, timedelta
from app.services.graph_service import _graph  # internal access is fine, same package

DATE_FORMATS = ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"]


def _parse_date(raw: str):
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def detect_patterns(min_occurrences: int = 2) -> list[dict]:
    """For every Equipment node, walk HAD_FAILURE -> Failure -> OCCURRED_ON -> Date
    chains, collect the dates, and flag equipment with a repeating interval."""
    results = []

    for node, data in _graph.nodes(data=True):
        if data.get("type") != "Equipment":
            continue

        failure_dates = []
        evidence = []
        for _, failure_node, edge_data in _graph.out_edges(node, data=True):
            if edge_data.get("relation") != "HAD_FAILURE":
                continue
            for _, date_node, date_edge in _graph.out_edges(failure_node, data=True):
                if date_edge.get("relation") != "OCCURRED_ON":
                    continue
                parsed = _parse_date(date_node)
                if parsed:
                    failure_dates.append(parsed)
                    evidence.append({
                        "failure": failure_node,
                        "date": date_node,
                        "sources": _graph.nodes[failure_node].get("sources", []),
                    })

        if len(failure_dates) < min_occurrences:
            continue

        failure_dates.sort()
        intervals_days = [
            (failure_dates[i + 1] - failure_dates[i]).days
            for i in range(len(failure_dates) - 1)
        ]
        if not intervals_days:
            continue

        avg_interval = statistics.mean(intervals_days)
        spread = statistics.pstdev(intervals_days) if len(intervals_days) > 1 else 0
        # Low spread relative to the average interval = a genuine recurring pattern
        regularity = 1 - min(spread / avg_interval, 1) if avg_interval else 0

        predicted_next = failure_dates[-1] + timedelta(days=avg_interval)

        results.append({
            "equipment": node,
            "failure_count": len(failure_dates),
            "avg_interval_days": round(avg_interval, 1),
            "regularity_score": round(regularity, 2),
            "predicted_next_failure": predicted_next.strftime("%Y-%m-%d"),
            "confidence": "high" if regularity > 0.7 else "medium" if regularity > 0.4 else "low",
            "evidence": evidence,
        })

    results.sort(key=lambda r: r["regularity_score"], reverse=True)
    return results
