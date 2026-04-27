"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import Link from "next/link";

interface StatCardProps {
  title: string;
  value: string;
  trend: string;
  isPositive: boolean;
  icon: LucideIcon;
  delay?: number;
  href?: string;
}

export function StatCard({ title, value, trend, isPositive, icon: Icon, delay = 0, href }: StatCardProps) {
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.02 }}
      className={`p-6 rounded-2xl bg-card border border-white/10 shadow-lg relative overflow-hidden group glass ${href ? 'cursor-pointer hover:border-primary/30' : ''}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="p-3 rounded-xl bg-white/5 group-hover:bg-primary/10 transition-colors">
          <Icon className="w-6 h-6 text-gray-400 group-hover:text-primary transition-colors" />
        </div>
        <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${isPositive ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
          }`}>
          {isPositive ? "+" : "-"}{trend}
        </span>
      </div>

      <div className="relative z-10">
        <h3 className="text-gray-400 font-medium mb-1">{title}</h3>
        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      </div>
    </motion.div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
