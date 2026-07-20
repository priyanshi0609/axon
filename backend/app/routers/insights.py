"""
Predictive Maintenance + dashboard endpoints. Powers the Executive
Dashboard and the "Failure Pattern Engine" differentiator.
"""

from fastapi import APIRouter
from app.services import graph_service, pattern_service

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("/patterns")
def failure_patterns(min_occurrences: int = 2):
    return {"patterns": pattern_service.detect_patterns(min_occurrences=min_occurrences)}


@router.get("/stats")
def dashboard_stats():
    graph_stats = graph_service.stats()
    patterns = pattern_service.detect_patterns()
    high_risk = [p for p in patterns if p["confidence"] == "high"]
    return {
        "graph": graph_stats,
        "total_patterns_detected": len(patterns),
        "high_confidence_predictions": len(high_risk),
        "top_predictions": patterns[:5],
    }
