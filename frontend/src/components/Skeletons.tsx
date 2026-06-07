import React from 'react';

// A generic loading layout for admin panels.
export const PanelSkeleton = () => (
  <div className="w-full min-h-[400px] bg-slate-900/40 border border-white/5 rounded-3xl p-8 space-y-6 animate-pulse">
    <div className="h-6 w-48 bg-white/10 rounded-lg" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="h-28 bg-white/5 rounded-2xl" />
      <div className="h-28 bg-white/5 rounded-2xl" />
      <div className="h-28 bg-white/5 rounded-2xl" />
    </div>
    <div className="h-64 bg-white/5 rounded-2xl" />
  </div>
);

// The outer admin dashboard layout loader.
export const AdminDashboardSkeleton = () => (
  <div className="min-h-screen bg-transparent animate-pulse">
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-10 pb-6 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl" />
          <div className="space-y-2">
            <div className="h-6 w-64 bg-white/10 rounded-lg" />
            <div className="h-3 w-40 bg-white/5 rounded-lg" />
          </div>
        </div>
        <div className="h-10 w-24 bg-white/5 rounded-xl" />
      </div>
      <div className="h-14 w-full bg-white/5 rounded-2xl mb-10" />
      <div className="w-full min-h-[400px] bg-white/5 rounded-3xl" />
    </div>
  </div>
);

// Chart grid and bars placeholder.
export const EarningsChartSkeleton = () => (
  <div className="h-80 bg-white/5 rounded-2xl border border-white/5 p-6 animate-pulse flex flex-col justify-between">
    <div className="flex justify-between items-center">
      <div className="h-6 w-36 bg-white/10 rounded" />
      <div className="h-8 w-24 bg-white/10 rounded" />
    </div>
    <div className="flex-1 flex items-end gap-2 mt-6">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="flex-1 bg-white/5 rounded-t" style={{ height: `${Math.sin(i / 2) * 40 + 50}%` }} />
      ))}
    </div>
  </div>
);

// Tree layout placeholder.
export const NetworkTreeSkeleton = () => (
  <div className="w-full h-[600px] rounded-2xl border border-white/5 bg-background animate-pulse flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="w-12 h-12 bg-white/10 rounded-full mx-auto" />
      <div className="h-4 w-36 bg-white/10 rounded mx-auto" />
      <div className="h-3 w-48 bg-white/5 rounded mx-auto" />
    </div>
  </div>
);

// Database inspection modal skeleton.
export const RealDatabaseInspectorSkeleton = () => (
  <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 md:p-8 animate-pulse">
    <div className="bg-[#0A0C10] border border-white/10 w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl" />
          <div className="space-y-2">
            <div className="h-5 w-48 bg-white/10 rounded" />
            <div className="h-3 w-28 bg-white/5 rounded" />
          </div>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r border-white/5 bg-black/20 p-4 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-8 bg-white/5 rounded-xl" />
          ))}
        </div>
        <div className="flex-1 p-6 space-y-4">
          <div className="h-6 w-32 bg-white/10 rounded" />
          <div className="border border-white/10 rounded-2xl bg-black/40 h-full p-4 space-y-3">
            <div className="h-8 bg-white/10 rounded" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-6 bg-white/5 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);
