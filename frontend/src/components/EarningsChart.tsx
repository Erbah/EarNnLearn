"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Link from "next/link";

const CHART_MARGIN = { top: 10, right: 10, left: -20, bottom: 0 };
const TOOLTIP_CONTENT_STYLE = { backgroundColor: "#1B2433", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff" };
const TOOLTIP_ITEM_STYLE = { color: "#00E0FF" };

export const EarningsChart = React.memo(function EarningsChart({ transactions }: { transactions?: any[] }) {
  const chartData = useMemo(() => {
    const dataPoints: Record<string, number> = {};
    const now = new Date();
    // Initialize last 7 days to 0
    for(let i = 6; i >= 0; i--) {
       const d = new Date(now);
       d.setDate(d.getDate() - i);
       dataPoints[d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })] = 0;
    }

    if (transactions && transactions.length > 0) {
      transactions.forEach(t => {
         if (t.type === "CREDIT") {
             const d = new Date(t.created_at);
             const key = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
             if (dataPoints[key] !== undefined) {
                 dataPoints[key] += Number(t.amount);
             }
         }
      });
    }

    return Object.entries(dataPoints).map(([name, earnings]) => ({ name, earnings }));
  }, [transactions]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="p-6 rounded-2xl bg-card/70 backdrop-blur-xl border border-white/5 shadow-lg col-span-1 lg:col-span-2 relative overflow-hidden group hover:border-primary/20 transition-all duration-300"
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Earnings Overview</h3>
          <p className="text-sm text-gray-400">Last 7 days growth</p>
        </div>
        <Link href="/wallet">
          <div
            className="px-4 py-2 rounded-xl bg-white/5 text-sm font-medium text-white hover:bg-white/10 transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-primary/50"
            role="button"
            tabIndex={0}
            aria-label="View Detailed Earnings Report"
          >
            Detailed Report
          </div>
        </Link>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00E0FF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00E0FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" stroke="#4B5563" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#4B5563" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
            <Tooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
            />
            <Area
              type="monotone"
              dataKey="earnings"
              stroke="#00E0FF"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorEarnings)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
});
