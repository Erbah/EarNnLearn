'use client';
import React, { useState, useEffect } from 'react';
import { API_BASE_URL, api } from '@/lib/api';

const API = `${API_BASE_URL}/api/v1/admin`;

interface LogRowProps {
  log: any;
}

const LogRow = React.memo(function LogRow({ log }: LogRowProps) {
  const formattedDate = React.useMemo(() => {
    return new Date(log.created_at).toLocaleString();
  }, [log.created_at]);

  return (
    <div className="py-2 border-b border-white/5 text-[10px] text-gray-400">
      <span className="text-primary font-bold">{formattedDate}</span>: {log.action}
    </div>
  );
});

export const LogsPanel = React.memo(function LogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => { 
    api.get(`${API}/logs`)
      .then(res => setLogs(Array.isArray(res.data) ? res.data : []))
      .catch(() => { }); 
  }, []);

  return (
    <div className="p-6 bg-card/70 border border-white/5 rounded-2xl">
      <h3 className="text-lg font-bold text-white mb-6">📜 Logs</h3>
      <div className="space-y-2">
        {logs.map((log, i) => (
          <LogRow key={i} log={log} />
        ))}
      </div>
    </div>
  );
});

export default LogsPanel;
