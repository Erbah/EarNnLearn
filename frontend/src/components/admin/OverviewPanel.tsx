'use client';
import React, { useState, useEffect } from 'react';
import { Stat } from './Stat';
import { API_BASE_URL, api } from '@/lib/api';
import axios from 'axios';

const API = `${API_BASE_URL}/api/v1/admin`;

const ANALYTICS_LOADING_STYLE = { color: '#9CA3AF', padding: '40px', textAlign: 'center' as const };

interface TopPromoter {
  rid: string;
  network_size: number;
}

interface AnalyticsData {
  total_users: number;
  activated_users: number;
  total_revenue: number | string;
  codes_used: number;
  codes_available: number;
  total_payouts: number | string;
  top_promoters?: TopPromoter[];
}

export const OverviewPanel = React.memo(function OverviewPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.get(`${API}/analytics`, { signal: controller.signal })
      .then(res => setData(res.data && typeof res.data === 'object' ? res.data : null))
      .catch((err) => {
        if (axios.isCancel(err)) return;
      });
    return () => controller.abort();
  }, []);

  if (!data) return <div style={ANALYTICS_LOADING_STYLE}>Loading analytics...</div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5 mb-8">
        <Stat label="Total Users" value={data.total_users ?? 0} />
        <Stat label="Activated Users" value={data.activated_users ?? 0} color="#FFD700" />
        <Stat label="Revenue (GHS)" value={(Number(data?.total_revenue) || 0).toFixed(2)} color="#10B981" />
        <Stat label="Codes Used" value={data.codes_used ?? 0} />
        <Stat label="Codes Available" value={data.codes_available ?? 0} color="#FFD700" />
        <Stat label="Total Payouts (GHS)" value={(Number(data?.total_payouts) || 0).toFixed(2)} color="#F59E0B" />
      </div>
      {(data.top_promoters && data.top_promoters.length > 0) && (
        <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl p-6 border border-white/10 max-w-2xl">
          <h3 className="text-xs uppercase font-bold text-gray-400 tracking-widest mb-6">🏆 Top Promoters</h3>
          <div className="space-y-4">
            {data.top_promoters.map((p: TopPromoter, i: number) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                <span className="text-primary font-mono font-bold">{p.rid}</span>
                <span className="text-yellow-500 font-bold text-sm">{p.network_size} referrals</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default OverviewPanel;
