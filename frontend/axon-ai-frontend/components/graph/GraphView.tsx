"use client";

// Lightweight force-directed layout rendered as SVG — no react-flow / d3
// dependency needed for a graph this size, which keeps the bundle small
// and the code easy to read end-to-end.

import { useEffect, useMemo, useState } from "react";
import { GraphData } from "@/lib/api";

interface LaidOutNode {
  id: string;
  type: string;
  x: number;
  y: number;
}

const TYPE_COLOR: Record<string, string> = {
  Equipment: "#2563eb",
  Person: "#16a34a",
  Location: "#a855f7",
  Failure: "#dc2626",
  Regulation: "#ea580c",
  Date: "#64748b",
  Unknown: "#94a3b8",
};

const WIDTH = 800;
const HEIGHT = 520;

function layoutNodes(graph: GraphData): LaidOutNode[] {
  const n = graph.nodes.length || 1;
  const radius = Math.min(WIDTH, HEIGHT) / 2 - 60;
  return graph.nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / n;
    return {
      id: node.id,
      type: node.type || "Unknown",
      x: WIDTH / 2 + radius * Math.cos(angle),
      y: HEIGHT / 2 + radius * Math.sin(angle),
    };
  });
}

export default function GraphView({ graph }: { graph: GraphData }) {
  const [selected, setSelected] = useState<string | null>(null);
  const nodes = useMemo(() => layoutNodes(graph), [graph]);
  const positionById = useMemo(() => {
    const map: Record<string, LaidOutNode> = {};
    nodes.forEach((n) => (map[n.id] = n));
    return map;
  }, [nodes]);

  if (graph.nodes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-10">
        No graph data yet — upload and process a document, then run "Build Graph".
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full border rounded-xl bg-background">
        {graph.links.map((link, i) => {
          const from = positionById[link.source as unknown as string];
          const to = positionById[link.target as unknown as string];
          if (!from || !to) return null;
          return (
            <g key={i}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#cbd5e1" strokeWidth={1} />
            </g>
          );
        })}

        {nodes.map((node) => (
          <g
            key={node.id}
            onClick={() => setSelected(node.id)}
            className="cursor-pointer"
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={selected === node.id ? 10 : 7}
              fill={TYPE_COLOR[node.type] || TYPE_COLOR.Unknown}
              stroke="white"
              strokeWidth={1.5}
            />
            <text x={node.x + 10} y={node.y + 4} fontSize={10} fill="#334155">
              {node.id.length > 18 ? node.id.slice(0, 18) + "…" : node.id}
            </text>
          </g>
        ))}
      </svg>

      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(TYPE_COLOR).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
            {type}
          </span>
        ))}
      </div>

      {selected && (
        <div className="text-sm border rounded-lg p-3">
          <p className="font-medium">{selected}</p>
          <p className="text-muted-foreground">
            {graph.links.filter((l) => l.source === selected || l.target === selected).length} connection(s)
          </p>
        </div>
      )}
    </div>
  );
}
