"use client";

import { useEffect, useState } from "react";
import { api, GraphData } from "@/lib/api";
import GraphView from "@/components/graph/GraphView";

export default function GraphPage() {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getFullGraph()
      .then(setGraph)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Knowledge Graph</h1>
      <p className="text-sm text-muted-foreground">
        Every equipment, engineer, failure, regulation, and date extracted from your documents, connected.
      </p>
      {loading ? <p className="text-sm">Loading graph...</p> : <GraphView graph={graph} />}
    </main>
  );
}
