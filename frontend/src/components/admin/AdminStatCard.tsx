'use client';
import React from 'react';

const COLORS_MAP: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  purple: "bg-purple-500/10 text-purple-500 border-purple-500/20"
};

interface AdminStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}

export const AdminStatCard = React.memo(function AdminStatCard({ icon, label, value, color }: AdminStatCardProps) {
  const colorClass = COLORS_MAP[color] || COLORS_MAP.blue;
  const classes = colorClass.split(' ');

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 transition-hover hover:border-white/20">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${classes[0]} ${classes[1]}`}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase font-bold text-gray-500 tracking-widest text-[#9CA3AF]">{label}</div>
        <div className="text-2xl font-bold text-white">{value}</div>
      </div>
    </div>
  );
});

export default AdminStatCard;
