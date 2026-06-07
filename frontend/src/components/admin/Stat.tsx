'use client';
import React from 'react';

interface StatProps {
  label: string;
  value: string | number;
  color?: string;
}

export const Stat = React.memo(function Stat({ label, value, color = '#00E0FF' }: StatProps) {
  return (
    <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col justify-center min-h-[110px] hover:border-white/20 transition-all">
      <div className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2">{label}</div>
      <div className="text-3xl font-black tracking-tight" style={{ color }}>{value}</div>
    </div>
  );
});

export default Stat;
