"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/colors";
import { formatCurrency } from "@/lib/format";

export default function SimpleBarChart({
  data,
  dataKey = "revenue",
  valueType = "currency",
  horizontal = false,
}: {
  data: { name: string; [key: string]: string | number }[];
  dataKey?: string;
  valueType?: "currency" | "count";
  horizontal?: boolean;
}) {
  const format = (v: number) => (valueType === "currency" ? formatCurrency(v) : `${v}`);

  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="#e2e8f0" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (valueType === "currency" ? `${Math.round(v / 1000)}k` : `${v}`)}
          />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: "#334155" }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => format(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip formatter={(v) => format(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} maxBarSize={36}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
