'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import { API_BASE_URL, api } from '@/lib/api';

const API = `${API_BASE_URL}/api/v1/admin`;

interface NotificationCardProps {
  note: any;
  onMarkRead: (id: string) => void;
}

const NotificationCard = React.memo(function NotificationCard({ note, onMarkRead }: NotificationCardProps) {
  const handleMarkRead = useCallback(() => {
    onMarkRead(note.id);
  }, [note.id, onMarkRead]);

  const formattedDate = React.useMemo(() => {
    return new Date(note.created_at).toLocaleString();
  }, [note.created_at]);

  return (
    <div className={`p-5 rounded-2xl border transition-all ${note.is_read ? 'bg-white/[0.02] border-white/5 opacity-60' : 'bg-primary/5 border-primary/20 shadow-lg shadow-primary/5'}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] uppercase font-black tracking-widest text-primary">{note.type}</span>
        <span className="text-[10px] text-gray-500">{formattedDate}</span>
      </div>
      <h4 className="text-sm font-bold text-white mb-1">{note.title}</h4>
      <p className="text-xs text-gray-400 leading-relaxed mb-4">{note.message}</p>
      
      <div className="flex gap-3">
        {!note.is_read && (
          <button onClick={handleMarkRead} className="px-4 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-primary hover:text-background transition-all">
            Mark as Read
          </button>
        )}
        {note.link && (
          <a href={note.link} className="flex items-center gap-1.5 px-4 py-1.5 bg-white/5 text-gray-300 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-white/10">
            <ExternalLink size={12} /> View Details
          </a>
        )}
      </div>
    </div>
  );
});

export const NotificationsPanel = React.memo(function NotificationsPanel() {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(() => {
    api.get(`${API}/notifications`)
      .then(res => setNotes(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const markRead = useCallback(async (id: string) => {
    try {
      await api.post(`${API}/notifications/${id}/read`);
      setNotes(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {}
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-white">🔔 Platform Notifications</h3>
        <button onClick={loadNotes} className="text-xs text-primary font-bold">Refresh</button>
      </div>
      
      <div className="space-y-3">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading alerts...</div>
        ) : notes.length === 0 ? (
          <div className="p-10 text-center text-gray-500 border border-dashed border-white/10 rounded-2xl italic">No notifications found</div>
        ) : (
          notes.map(note => (
            <NotificationCard
              key={note.id}
              note={note}
              onMarkRead={markRead}
            />
          ))
        )}
      </div>
    </div>
  );
});

export default NotificationsPanel;
