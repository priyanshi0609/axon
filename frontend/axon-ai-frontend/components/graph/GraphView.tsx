"use client";

// Lightweight force-directed layout rendered as SVG — no react-flow / d3
// dependency needed for a graph this size, which keeps the bundle small
// and the code easy to read end-to-end.

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from "react";
import { GraphData } from "@/lib/api";

interface SimNode {
  id: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed?: boolean;
}

const TYPE_COLOR: Record<string, string> = {
  Equipment: "#3b82f6",
  Person: "#22c55e",
  Location: "#a855f7",
  Failure: "#ef4444",
  Regulation: "#f97316",
  Date: "#64748b",
  Unknown: "#94a3b8",
};

const WIDTH = 800;
const HEIGHT = 520;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };

// physics constants
const REPULSION = 2200;
const SPRING_LENGTH = 110;
const SPRING_STRENGTH = 0.02;
const CENTER_STRENGTH = 0.004;
const DAMPING = 0.85;
const SIM_FRAMES = 240;

function seedPositions(graph: GraphData): SimNode[] {
  const n = graph.nodes.length || 1;
  const radius = Math.min(WIDTH, HEIGHT) / 2 - 80;
  return graph.nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / n;
    return {
      id: node.id,
      type: node.type || "Unknown",
      x: CENTER.x + radius * Math.cos(angle),
      y: CENTER.y + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
    };
  });
}

export default function GraphView({ graph }: { graph: GraphData }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [nodes, setNodes] = useState<SimNode[]>(() => seedPositions(graph));
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

  const nodesRef = useRef<SimNode[]>(nodes);
  const draggingRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const links = useMemo(() => graph.links.filter((l) => l.source && l.target), [graph.links]);

  // reseed layout whenever the graph itself changes
  useEffect(() => {
    const seeded = seedPositions(graph);
    nodesRef.current = seeded;
    setNodes(seeded);
  }, [graph]);

  // force simulation — repulsion + spring edges + centering, runs for a fixed
  // number of frames then settles so it doesn't spin the CPU forever
  useEffect(() => {
    let frame = 0;

    function tick() {
      const current = nodesRef.current;
      const byId: Record<string, SimNode> = {};
      current.forEach((n) => (byId[n.id] = n));

      for (let i = 0; i < current.length; i++) {
        for (let j = i + 1; j < current.length; j++) {
          const a = current[i];
          const b = current[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy || 0.01;
          const dist = Math.sqrt(distSq);
          const force = REPULSION / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (!a.fixed) {
            a.vx += fx;
            a.vy += fy;
          }
          if (!b.fixed) {
            b.vx -= fx;
            b.vy -= fy;
          }
        }
      }

      links.forEach((link) => {
        const a = byId[link.source as unknown as string];
        const b = byId[link.target as unknown as string];
        if (!a || !b) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const diff = dist - SPRING_LENGTH;
        const fx = (dx / dist) * diff * SPRING_STRENGTH;
        const fy = (dy / dist) * diff * SPRING_STRENGTH;
        if (!a.fixed) {
          a.vx += fx;
          a.vy += fy;
        }
        if (!b.fixed) {
          b.vx -= fx;
          b.vy -= fy;
        }
      });

      current.forEach((n) => {
        if (n.fixed) return;
        n.vx += (CENTER.x - n.x) * CENTER_STRENGTH;
        n.vy += (CENTER.y - n.y) * CENTER_STRENGTH;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(30, Math.min(WIDTH - 30, n.x));
        n.y = Math.max(30, Math.min(HEIGHT - 30, n.y));
      });

      frame++;
      setNodes([...current]);
      if (frame < SIM_FRAMES) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [graph, links]);

  const positionById = useMemo(() => {
    const map: Record<string, SimNode> = {};
    nodes.forEach((n) => (map[n.id] = n));
    return map;
  }, [nodes]);

  // subgraph highlighted on hover/select
  const connectedIds = useMemo(() => {
    const active = hovered || selected;
    if (!active) return null;
    const ids = new Set<string>([active]);
    links.forEach((l) => {
      if (l.source === active) ids.add(l.target as unknown as string);
      if (l.target === active) ids.add(l.source as unknown as string);
    });
    return ids;
  }, [hovered, selected, links]);

  const matchesQuery = useCallback(
    (id: string) => query.trim().length > 0 && id.toLowerCase().includes(query.trim().toLowerCase()),
    [query]
  );

  const visibleTypes = useMemo(() => {
    const s = new Set<string>();
    graph.nodes.forEach((n) => s.add(n.type || "Unknown"));
    return Array.from(s);
  }, [graph.nodes]);

  function toSvgPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const rawX = ((clientX - rect.left) * WIDTH) / rect.width;
    const rawY = ((clientY - rect.top) * HEIGHT) / rect.height;
    return { x: (rawX - transform.x) / transform.k, y: (rawY - transform.y) / transform.k };
  }

  function onNodeMouseDown(e: ReactMouseEvent, id: string) {
    e.stopPropagation();
    const pt = toSvgPoint(e.clientX, e.clientY);
    const node = nodesRef.current.find((n) => n.id === id);
    if (!node) return;
    node.fixed = true;
    draggingRef.current = { id, offsetX: pt.x - node.x, offsetY: pt.y - node.y };
  }

  function onSvgMouseMove(e: ReactMouseEvent) {
    if (draggingRef.current) {
      const pt = toSvgPoint(e.clientX, e.clientY);
      const node = nodesRef.current.find((n) => n.id === draggingRef.current!.id);
      if (node) {
        node.x = pt.x - draggingRef.current.offsetX;
        node.y = pt.y - draggingRef.current.offsetY;
        setNodes([...nodesRef.current]);
      }
    } else if (panRef.current) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setTransform((t) => ({ ...t, x: panRef.current!.origX + dx, y: panRef.current!.origY + dy }));
    }
  }

  function onSvgMouseUp() {
    draggingRef.current = null; // node stays pinned where dropped
    panRef.current = null;
  }

  function onBackgroundMouseDown(e: ReactMouseEvent) {
    panRef.current = { startX: e.clientX, startY: e.clientY, origX: transform.x, origY: transform.y };
  }

  function onWheel(e: ReactWheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => ({ ...t, k: Math.max(0.4, Math.min(3, t.k * delta)) }));
  }

  function toggleType(type: string) {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  if (graph.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 border rounded-xl bg-muted/20">
        <p className="text-sm text-muted-foreground text-center">
          No graph data yet — upload and process a document, then run "Build Graph".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes..."
          className="text-sm border rounded-md px-3 py-1.5 w-56 outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex flex-wrap gap-2 text-xs">
          {visibleTypes.map((type) => {
            const isHidden = hiddenTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-opacity ${
                  isHidden ? "opacity-35" : "opacity-100"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: TYPE_COLOR[type] || TYPE_COLOR.Unknown }}
                />
                {type}
              </button>
            );
          })}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full border rounded-xl bg-gradient-to-br from-background to-muted/30 cursor-grab active:cursor-grabbing"
        onMouseMove={onSvgMouseMove}
        onMouseUp={onSvgMouseUp}
        onMouseLeave={onSvgMouseUp}
        onMouseDown={onBackgroundMouseDown}
        onWheel={onWheel}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
          </marker>
          <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.25" />
          </filter>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {links.map((link, i) => {
            const from = positionById[link.source as unknown as string];
            const to = positionById[link.target as unknown as string];
            if (!from || !to) return null;
            if (hiddenTypes.has(from.type) || hiddenTypes.has(to.type)) return null;
            const active = connectedIds ? connectedIds.has(from.id) && connectedIds.has(to.id) : true;
            const dimmed = connectedIds && !active;
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            const showLabel =
              (hovered === from.id || hovered === to.id || selected === from.id || selected === to.id) &&
              (link as { relation?: string }).relation;

            return (
              <g key={i} opacity={dimmed ? 0.12 : 1}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={active && connectedIds ? "#64748b" : "#cbd5e1"}
                  strokeWidth={active && connectedIds ? 1.5 : 1}
                  markerEnd="url(#arrow)"
                />
                {showLabel && (
                  <g>
                    <rect
                      x={midX - ((link as { relation?: string }).relation!.length * 5.2 + 8) / 2}
                      y={midY - 14}
                      width={(link as { relation?: string }).relation!.length * 5.2 + 8}
                      height={12}
                      rx={3}
                      fill="white"
                      fillOpacity={0.85}
                    />
                    <text x={midX} y={midY - 5} fontSize={9} textAnchor="middle" fill="#475569" className="select-none">
                      {(link as { relation?: string }).relation}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {nodes.map((node) => {
            if (hiddenTypes.has(node.type)) return null;
            const isActive = connectedIds ? connectedIds.has(node.id) : true;
            const isSelected = selected === node.id;
            const isHovered = hovered === node.id;
            const matched = matchesQuery(node.id);
            const label = node.id.length > 20 ? node.id.slice(0, 20) + "…" : node.id;

            return (
              <g
                key={node.id}
                onMouseDown={(e) => onNodeMouseDown(e, node.id)}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(node.id === selected ? null : node.id);
                }}
                className="cursor-pointer"
                opacity={connectedIds && !isActive ? 0.15 : 1}
              >
                {matched && (
                  <circle cx={node.x} cy={node.y} r={14} fill="none" stroke="#facc15" strokeWidth={2}>
                    <animate attributeName="r" values="12;16;12" dur="1.4s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isSelected ? 10 : isHovered ? 9 : 7}
                  fill={TYPE_COLOR[node.type] || TYPE_COLOR.Unknown}
                  stroke={isSelected ? "#1e293b" : "white"}
                  strokeWidth={isSelected ? 2 : 1.5}
                  filter="url(#nodeShadow)"
                />
                <rect
                  x={node.x + 10}
                  y={node.y - 8}
                  width={label.length * 5.4 + 6}
                  height={13}
                  rx={3}
                  fill="white"
                  fillOpacity={0.75}
                />
                <text x={node.x + 13} y={node.y + 2} fontSize={10} fill="#1e293b" className="select-none">
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {selected && positionById[selected] && (
        <div className="text-sm border rounded-lg p-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: TYPE_COLOR[positionById[selected].type] || TYPE_COLOR.Unknown }}
              />
              <p className="font-medium">{selected}</p>
              <span className="text-xs text-muted-foreground">({positionById[selected].type})</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">
              ✕
            </button>
          </div>
          <div className="mt-2 space-y-1">
            {links
              .filter((l) => l.source === selected || l.target === selected)
              .map((l, idx) => {
                const other = l.source === selected ? (l.target as unknown as string) : (l.source as unknown as string);
                const relation = (l as { relation?: string }).relation;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelected(other)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full text-left"
                  >
                    <span className="text-primary">{l.source === selected ? "→" : "←"}</span>
                    {relation && <span className="italic">{relation}</span>}
                    <span className="font-medium text-foreground">{other}</span>
                  </button>
                );
              })}
            {links.filter((l) => l.source === selected || l.target === selected).length === 0 && (
              <p className="text-xs text-muted-foreground">No connections found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}