// Shared API client for the Axon frontend. Every component fetches through
// here so the backend base URL only lives in one place.

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  return res.json();
}

export interface ChatSource {
  filename: string;
  score: number;
}

export interface ChatResponse {
  question: string;
  answer: string;
  confidence: "high" | "medium" | "low";
  sources: ChatSource[];
  graph_entities_used: string[];
}

export interface GraphNode {
  id: string;
  type?: string;
  sources?: string[];
}

export interface GraphLink {
  source: string;
  target: string;
  relation: string;
  file_id?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface FailurePattern {
  equipment: string;
  failure_count: number;
  avg_interval_days: number;
  regularity_score: number;
  predicted_next_failure: string;
  confidence: "high" | "medium" | "low";
}

export interface DashboardStats {
  graph: { node_count: number; edge_count: number; node_types: Record<string, number> };
  total_patterns_detected: number;
  high_confidence_predictions: number;
  top_predictions: FailurePattern[];
}

export const api = {
  askQuestion: (question: string, fileId?: string) =>
    request<ChatResponse>("/chat/ask", {
      method: "POST",
      body: JSON.stringify({ question, file_id: fileId ?? null }),
    }),

  getFullGraph: () => request<GraphData>("/graph/full"),

  extractGraph: (fileId: string) =>
    request(`/graph/extract/${fileId}`, { method: "POST" }),

  getPatterns: () => request<{ patterns: FailurePattern[] }>("/insights/patterns"),

  getDashboardStats: () => request<DashboardStats>("/insights/stats"),
};
