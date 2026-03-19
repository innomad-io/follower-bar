import { useEffect, useId, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getSnapshots7d } from "../lib/commands";
import type { Snapshot } from "../types";

interface MiniChartProps {
  accountId: string;
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

        setData(
          snapshots.map((snapshot) => ({
            day: new Date(snapshot.fetched_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            }),
            followers: snapshot.followers,
          }))
        );
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
    return <div className="px-2 py-4 text-xs title-muted">Loading trend...</div>;
  }

  if (data.length < 2) {
    return <div className="px-2 py-4 text-xs title-muted">Not enough data yet.</div>;
  }

  return (
    <div className="rounded-[18px] border border-slate-200/70 bg-white/70 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
      <ResponsiveContainer width="100%" height={92}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d94b91" stopOpacity={0.34} />
              <stop offset="100%" stopColor="#7c5ce0" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" hide />
          <YAxis dataKey="followers" hide domain={["dataMin", "dataMax"]} />
          <Tooltip
            contentStyle={{
              background: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(137, 136, 157, 0.14)",
              borderRadius: 12,
              color: "#2f2842",
              boxShadow: "0 10px 28px rgba(166, 163, 189, 0.14)",
            }}
          />
          <Area
            dataKey="followers"
            type="monotone"
            stroke="#9c69e2"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
