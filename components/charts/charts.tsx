"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/money";
import type { CampaignBreakdownRow, DailyPoint } from "@/lib/services/metrics";

const COLORS = {
  creator: "var(--chart-1)",
  customer: "var(--chart-2)",
  neutral: "var(--chart-5)",
  reward: "var(--chart-2)",
  commission: "var(--chart-3)",
  revenue: "var(--chart-1)",
};

const tooltipStyle = {
  contentStyle: {
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--muted-foreground)" },
};

const axisProps = { tick: { fontSize: 11, fill: "var(--muted-foreground)" }, axisLine: false, tickLine: false } as const;

function Empty({ message }: { message: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{message}</div>;
}

export function ReferralsOverTimeChart({ data }: { data: DailyPoint[] }) {
  const hasData = data.some((d) => d.total > 0);
  return (
    <div className="h-64">
      {!hasData ? (
        <Empty message="No referrals in the last 30 days yet." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="fillCreator" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.creator} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLORS.creator} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillCustomer" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.customer} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLORS.customer} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="creator" name="Creator referrals" stackId="1" stroke={COLORS.creator} fill="url(#fillCreator)" />
            <Area type="monotone" dataKey="customer" name="Customer referrals" stackId="1" stroke={COLORS.customer} fill="url(#fillCustomer)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function RevenueByCampaignChart({ data }: { data: CampaignBreakdownRow[] }) {
  const rows = data.filter((d) => d.revenue > 0);
  return (
    <div className="h-64">
      {!rows.length ? (
        <Empty message="No verified revenue yet." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" {...axisProps} tickFormatter={(v: number) => formatMoney(v, "INR", { compact: true })} />
            <YAxis type="category" dataKey="name" width={120} {...axisProps} />
            <Tooltip {...tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
            <Bar dataKey="revenue" name="Attributed revenue" fill={COLORS.revenue} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function CostByCampaignChart({ data }: { data: CampaignBreakdownRow[] }) {
  const rows = data.filter((d) => d.rewardCost + d.commissionCost > 0);
  return (
    <div className="h-64">
      {!rows.length ? (
        <Empty message="No approved rewards or commissions yet." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" {...axisProps} interval={0} tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + "…" : v)} />
            <YAxis {...axisProps} tickFormatter={(v: number) => formatMoney(v, "INR", { compact: true })} />
            <Tooltip {...tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="rewardCost" name="Customer rewards" stackId="c" fill={COLORS.reward} />
            <Bar dataKey="commissionCost" name="Creator commissions" stackId="c" fill={COLORS.commission} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function PartnerSplitChart({ creator, customer }: { creator: number; customer: number }) {
  const total = creator + customer;
  const data = [
    { name: "Creator referrals", value: creator, color: COLORS.creator },
    { name: "Customer referrals", value: customer, color: COLORS.customer },
  ];
  return (
    <div className="h-64">
      {!total ? (
        <Empty message="No referrals yet." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={0}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function FunnelChart({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  const hasData = steps.some((s) => s.value > 0);
  return (
    <div className="flex h-64 flex-col justify-center gap-3">
      {!hasData ? (
        <Empty message="No activity recorded yet." />
      ) : (
        steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1].value : null;
          const rate = prev ? Math.round((s.value / prev) * 100) : null;
          return (
            <div key={s.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{s.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {s.value.toLocaleString("en-IN")}
                  {rate !== null ? ` · ${rate}%` : ""}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${Math.max(2, (s.value / max) * 100)}%`, opacity: 1 - i * 0.15 }}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
