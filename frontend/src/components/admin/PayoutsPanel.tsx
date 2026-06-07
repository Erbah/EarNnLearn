'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL, api } from '@/lib/api';

const API = `${API_BASE_URL}/api/v1/admin`;

interface PayoutRowProps {
  request: any;
  onAction: (id: string, action: 'approve' | 'reject') => void;
}

const PayoutRow = React.memo(function PayoutRow({ request, onAction }: PayoutRowProps) {
  const handleApprove = useCallback(() => {
    onAction(request.id, 'approve');
  }, [request.id, onAction]);

  const handleReject = useCallback(() => {
    onAction(request.id, 'reject');
  }, [request.id, onAction]);

  const payoutDetailsText = React.useMemo(() => {
    return Object.entries(request.payout_details || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }, [request.payout_details]);

  const createdDateText = React.useMemo(() => {
    return new Date(request.created_at).toLocaleDateString();
  }, [request.created_at]);

  return (
    <tr className="hover:bg-white/5 transition-colors">
      <td className="px-4 py-4 font-mono text-primary">{request.user_rid}</td>
      <td className="px-4 py-4 font-bold text-white">{request.amount} GHS</td>
      <td className="px-4 py-4 text-gray-400">{request.payout_method}</td>
      <td className="px-4 py-4 text-gray-500 text-[11px]">{payoutDetailsText}</td>
      <td className="px-4 py-4 text-gray-500">{createdDateText}</td>
      <td className="px-4 py-4 text-right space-x-2">
        <button
          onClick={handleApprove}
          className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold hover:opacity-80 transition-all"
        >
          Approve
        </button>
        <button
          onClick={handleReject}
          className="bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1.5 rounded-lg font-bold hover:bg-red-500 hover:text-white transition-all"
        >
          Reject
        </button>
      </td>
    </tr>
  );
});

export const PayoutsPanel = React.memo(function PayoutsPanel() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = useCallback(() => {
    api.get(`${API}/withdrawals/pending`)
      .then(res => setRequests(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleAction = useCallback(async (id: string, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? prompt("Enter rejection reason:") : null;
    if (action === 'reject' && !reason) return;

    try {
      await api.post(`${API}/withdrawals/${id}/${action}${reason ? `?reason=${reason}` : ''}`);
      alert(`Withdrawal ${action}d successfully`);
      loadRequests();
    } catch (e) {}
  }, [loadRequests]);

  return (
    <div className="bg-card/70 border border-white/5 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-white mb-6">💰 Pending Withdrawals</h3>
      {loading ? (
        <div className="p-10 text-center text-gray-500">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="p-10 text-center text-gray-500 italic">No pending withdrawal requests</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-gray-500">
                <th className="px-4 py-3 font-bold uppercase tracking-widest text-[10px]">RID</th>
                <th className="px-4 py-3 font-bold uppercase tracking-widest text-[10px]">Amount</th>
                <th className="px-4 py-3 font-bold uppercase tracking-widest text-[10px]">Method</th>
                <th className="px-4 py-3 font-bold uppercase tracking-widest text-[10px]">Details</th>
                <th className="px-4 py-3 font-bold uppercase tracking-widest text-[10px]">Date</th>
                <th className="px-4 py-3 font-bold uppercase tracking-widest text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {requests.map(req => (
                <PayoutRow
                  key={req.id}
                  request={req}
                  onAction={handleAction}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

export default PayoutsPanel;
