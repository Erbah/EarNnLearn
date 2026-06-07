"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, UserPlus, ArrowUpRight, KeyRound } from "lucide-react";
import Link from "next/link";

export const ActivityFeed = React.memo(function ActivityFeed({ activities }: { activities?: any[] }) {
  const displayActivities = useMemo(() => {
    return activities?.map((a, i) => ({
      id: a.id || i,
      title: a.description || a.type,
      time: new Date(a.created_at).toLocaleTimeString() || "Just now",
      icon: a.type?.includes("CREDIT") ? Plus : a.type?.includes("DEBIT") ? ArrowUpRight : KeyRound,
      color: a.type?.includes("CREDIT") ? "text-green-400" : "text-primary",
      bg: a.type?.includes("CREDIT") ? "bg-green-500/10" : "bg-primary/10",
    })).slice(0, 5) || [];
  }, [activities]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="p-6 rounded-2xl bg-card border border-white/5 shadow-lg mt-6"
    >
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
        <Link href="/wallet">
          <button className="text-sm text-primary hover:text-white transition-colors cursor-pointer">View All</button>
        </Link>
      </div>

      <div className="space-y-6">
        {displayActivities.length > 0 ? displayActivities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + index * 0.1 }}
            className="flex items-start space-x-4 group cursor-pointer"
          >
            <div className={`p-2.5 rounded-full ${activity.bg} mt-0.5 group-hover:scale-110 transition-transform`}>
              <activity.icon className={`w-4 h-4 ${activity.color}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                {activity.title}
              </p>
              <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
            </div>
          </motion.div>
        )) : (
          <p className="text-center text-gray-500 py-4 text-sm font-medium">No recent activity found.</p>
        )}
      </div>
    </motion.div>
  );
});
