import { useEffect, useId, useState } from "react";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { getSnapshots7d } from "../lib/commands";
import type { Snapshot } from "../types";

interface MiniChartProps {
  accountId: string;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function buildSevenDaySeries(snapshots: Snapshot[]) {
  const byDay = new Map<string, number>();

  for (const snapshot of snapshots) {
    const date = new Date(snapshot.fetched_at);
    const key = date.toISOString().slice(0, 10);
    byDay.set(key, snapshot.followers);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows: Array<{ day: string; followers: number }> = [];
  let fallback = 0;

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const nextValue = byDay.get(key);
    if (typeof nextValue === "number") {
      fallback = nextValue;
    }
    rows.push({
      day: formatDayLabel(date),
      followers: fallback,
    });
  }

  return rows;
}

export function MiniChart({ accountId }: MiniChartProps) {
  const [data, setData] = useState<Array<{ day: string; followers: number }>>([]);
  const [loading, setLoading] = useState(true);
  const gradientId = useId().replace(/:/g, "");

  useEffect(() => {
    let cancelled = false;

    void getSnapshots7d(accountId)
      .then((snapshots: Snapshot[]) => {
        if (cancelled) {
          return;
        }

        setData(buildSevenDaySeries(snapshots));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (loading) {
    return <div className="mini-chart-placeholder">Loading trend...</div>;
  }

  if (!data.some((item) => item.followers > 0)) {
    return <div className="mini-chart-placeholder">Not enough data yet.</div>;
  }

  return (
    <div className="mini-chart-shell">
      <ResponsiveContainer width="100%" height={56}>
        <BarChart data={data} barCategoryGap={4}>
          <XAxis dataKey="day" hide />
          <YAxis dataKey="followers" hide domain={["dataMin", "dataMax"]} />
          <Bar
            dataKey="followers"
            radius={[2, 2, 0, 0]}
            fill={`url(#${gradientId})`}
          />
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#d3e2f6" />
              <stop offset="85%" stopColor="#5a8fcf" />
              <stop offset="100%" stopColor="#005bc1" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
