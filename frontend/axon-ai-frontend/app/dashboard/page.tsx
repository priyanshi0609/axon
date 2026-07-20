"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Network, Activity } from "lucide-react";
import { api, DashboardStats } from "@/lib/api";

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <div className="border rounded-xl p-4 flex items-center gap-3">
      <Icon className="h-6 w-6 text-primary" />
      <div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.getDashboardStats().then(setStats);
  }, []);

  if (!stats) return <main className="p-6">Loading dashboard...</main>;

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Executive Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Graph nodes" value={stats.graph.node_count} icon={Network} />
        <StatCard label="Graph relationships" value={stats.graph.edge_count} icon={Activity} />
        <StatCard label="Failure patterns found" value={stats.total_patterns_detected} icon={AlertTriangle} />
        <StatCard label="High-confidence predictions" value={stats.high_confidence_predictions} icon={AlertTriangle} />
      </div>

      <div>
        <h2 className="font-medium mb-2">Top predicted failures</h2>
        {stats.top_predictions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recurring failure patterns detected yet.</p>
        ) : (
          <div className="space-y-2">
            {stats.top_predictions.map((p, i) => (
              <div key={i} className="border rounded-lg p-3 text-sm flex justify-between">
                <div>
                  <p className="font-medium">{p.equipment}</p>
                  <p className="text-muted-foreground">
                    {p.failure_count} failures, ~every {p.avg_interval_days} days
                  </p>
                </div>
                <div className="text-right">
                  <p>Next predicted: {p.predicted_next_failure}</p>
                  <p className="text-xs text-muted-foreground">confidence: {p.confidence}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
