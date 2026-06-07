'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { API_BASE_URL, api } from '@/lib/api';
import { InspectUserModal } from './InspectUserModal';

import axios from 'axios';

const API = `${API_BASE_URL}/api/v1/admin`;

/* ───── Static Style Constants ───── */
const PANEL_CONTAINER_STYLE = { background: 'rgba(27,36,51,0.7)', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto' as const };
const TITLE_STYLE = { fontSize: '16px', fontWeight: 600, color: '#E5E7EB', marginBottom: '16px' };
const TABLE_STYLE = { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' };
const TH_BORDER_STYLE = { borderBottom: '1px solid rgba(255,255,255,0.1)' };
const TH_STYLE = { textAlign: 'left' as const, padding: '10px 12px', color: '#9CA3AF', fontWeight: 500 };
const ROW_BORDER_STYLE = { borderBottom: '1px solid rgba(255,255,255,0.03)' };
const CELL_STYLE = { padding: '10px 12px', color: '#E5E7EB' };
const CELL_MUTED_STYLE = { padding: '10px 12px', color: '#9CA3AF' };
const RID_CELL_STYLE = { padding: '10px 12px', color: '#00E0FF', fontFamily: 'monospace', fontSize: '11px' };
const TIER_SPAN_STYLE = { background: 'rgba(0,224,255,0.1)', color: '#00E0FF', padding: '2px 10px', borderRadius: '20px', fontSize: '11px' };

interface UserRowProps {
  user: any;
  onInspect: (rid: string) => void;
}

const UserRow = React.memo(function UserRow({ user, onInspect }: UserRowProps) {
  const handleInspectClick = useCallback(() => {
    if (user.rid) {
      onInspect(user.rid);
    }
  }, [user.rid, onInspect]);

  return (
    <tr style={ROW_BORDER_STYLE}>
      <td style={CELL_STYLE}>{user.name}</td>
      <td style={CELL_MUTED_STYLE}>{user.email}</td>
      <td style={RID_CELL_STYLE}>{user.rid || '—'}</td>
      <td style={CELL_STYLE}>
        <span style={TIER_SPAN_STYLE}>{user.tier_type}</span>
      </td>
      <td style={CELL_STYLE}>
        <span style={{ color: user.status === 'active' ? '#10B981' : '#EF4444' }}>
          {user.status}
        </span>
      </td>
      <td style={CELL_STYLE}>
        <button
          onClick={handleInspectClick}
          className="p-1.5 hover:bg-white/5 rounded-lg text-primary transition-colors"
          title="Inspect User"
        >
          <Search className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
});

export const UsersPanel = React.memo(function UsersPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [inspectingRid, setInspectingRid] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.get(`${API}/users`, { signal: controller.signal })
      .then(res => setUsers(Array.isArray(res.data) ? res.data : []))
      .catch(err => {
        if (axios.isCancel(err)) return;
      });
    return () => controller.abort();
  }, []);

  const handleInspect = useCallback((rid: string) => {
    setInspectingRid(rid);
  }, []);

  const handleCloseInspect = useCallback(() => {
    setInspectingRid(null);
  }, []);

  return (
    <div style={PANEL_CONTAINER_STYLE}>
      <h3 style={TITLE_STYLE}>👥 Users ({users.length})</h3>
      <table style={TABLE_STYLE}>
        <thead>
          <tr style={TH_BORDER_STYLE}>
            {['Name', 'Email', 'RID', 'Tier', 'Status', 'Actions'].map(h => (
              <th key={h} style={TH_STYLE}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <UserRow
              key={i}
              user={u}
              onInspect={handleInspect}
            />
          ))}
        </tbody>
      </table>

      <AnimatePresence>
        {inspectingRid && (
          <InspectUserModal
            rid={inspectingRid}
            onClose={handleCloseInspect}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

export default UsersPanel;
