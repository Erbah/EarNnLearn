'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL, api } from '@/lib/api';

const API = `${API_BASE_URL}/api/v1/admin`;

/* ───── Static Style Constants ───── */
const SETTINGS_BOX_STYLE = { background: 'rgba(27,36,51,0.7)', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)' };
const TITLE_STYLE = { fontSize: '16px', fontWeight: 600, color: '#E5E7EB', marginBottom: '16px' };
const ROW_STYLE = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' };
const ROW_TITLE_STYLE = { fontSize: '13px', fontWeight: 600, color: '#E5E7EB' };
const ROW_DESC_STYLE = { fontSize: '11px', color: '#6B7280' };
const ROW_RIGHT_STYLE = { display: 'flex', alignItems: 'center', gap: '12px' };
const ROW_VAL_STYLE = { color: '#FFD700', fontFamily: 'monospace', fontSize: '14px' };
const EDIT_BTN_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '4px 12px', color: '#9CA3AF', fontSize: '11px', cursor: 'pointer' };
const DIVIDER_STYLE = { border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', margin: '24px 0' };

interface Setting {
  key: string;
  value: string;
  description: string;
}

interface SettingRowProps {
  setting: Setting;
  isEditing: boolean;
  editVal: string;
  onEdit: (key: string, value: string) => void;
  onSave: (key: string) => void;
  onEditValChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SettingRow = React.memo(function SettingRow({
  setting,
  isEditing,
  editVal,
  onEdit,
  onSave,
  onEditValChange,
}: SettingRowProps) {
  const handleEditClick = useCallback(() => {
    onEdit(setting.key, setting.value);
  }, [setting.key, setting.value, onEdit]);

  const handleSaveClick = useCallback(() => {
    onSave(setting.key);
  }, [setting.key, onSave]);

  return (
    <div style={ROW_STYLE}>
      <div>
        <div style={ROW_TITLE_STYLE}>{setting.key}</div>
        <div style={ROW_DESC_STYLE}>{setting.description}</div>
      </div>
      {isEditing ? (
        <div className="flex gap-2">
          <input
            value={editVal}
            onChange={onEditValChange}
            title={`Edit value for ${setting.key}`}
            aria-label={`Edit value for ${setting.key}`}
            className="bg-white/5 border border-primary/30 rounded-lg px-3 py-1.5 text-foreground text-[13px] w-30 outline-none"
          />
          <button
            onClick={handleSaveClick}
            className="bg-primary text-background border-none rounded-lg px-4 py-1.5 font-semibold text-[12px] cursor-pointer"
          >
            Save
          </button>
        </div>
      ) : (
        <div style={ROW_RIGHT_STYLE}>
          <span style={ROW_VAL_STYLE}>{setting.value}</span>
          <button onClick={handleEditClick} style={EDIT_BTN_STYLE}>
            Edit
          </button>
        </div>
      )}
    </div>
  );
});

export const SettingsPanel = React.memo(function SettingsPanel() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  const loadSettings = useCallback(() => {
    api.get(`${API}/settings`).then(res => setSettings(res.data)).catch(() => { });
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const save = useCallback(async (key: string) => {
    await api.put(`${API}/settings/${key}`, { value: editVal });
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value: editVal } : s));
    setEditing(null);
  }, [editVal]);

  const handleEdit = useCallback((key: string, value: string) => {
    setEditing(key);
    setEditVal(value);
  }, []);

  const handleEditValChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditVal(e.target.value);
  }, []);

  const handleCurrentPwChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentPw(e.target.value);
    setPwMsg('');
  }, []);

  const handleNewPwChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPw(e.target.value);
    setPwMsg('');
  }, []);

  const handlePasswordUpdate = useCallback(async () => {
    if (!currentPw || !newPw) { setPwMsg('Fill required fields'); return; }
    setPwMsg('Updating...');
    try {
      await api.put(`${API}/credentials`, { current_password: currentPw, new_password: newPw });
      setPwMsg('Password updated successfully!');
      setCurrentPw(''); setNewPw('');
    } catch (e: any) {
      setPwMsg(e.response?.data?.detail || 'Update failed');
    }
  }, [currentPw, newPw]);

  return (
    <div style={SETTINGS_BOX_STYLE}>
      <h3 style={TITLE_STYLE}>⚙️ System Settings</h3>
      {settings.map(s => (
        <SettingRow
          key={s.key}
          setting={s}
          isEditing={editing === s.key}
          editVal={editVal}
          onEdit={handleEdit}
          onSave={save}
          onEditValChange={handleEditValChange}
        />
      ))}

      <hr style={DIVIDER_STYLE} />
      <h3 style={TITLE_STYLE}>🔒 Update Master Password</h3>
      
      <div className="flex flex-col gap-3 max-w-sm">
        <input
          type="password"
          placeholder="Current Password"
          value={currentPw}
          onChange={handleCurrentPwChange}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground text-[13px] outline-none focus:border-primary"
        />
        <input
          type="password"
          placeholder="New Password"
          value={newPw}
          onChange={handleNewPwChange}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground text-[13px] outline-none focus:border-primary"
        />
        <button
          onClick={handlePasswordUpdate}
          disabled={!currentPw || !newPw}
          className="bg-primary text-background font-bold px-4 py-2.5 rounded-xl text-[13px] hover:scale-[1.02] transition-all disabled:opacity-50"
        >
          Change Password
        </button>
        {pwMsg && <div className="text-[12px] text-primary">{pwMsg}</div>}
      </div>
    </div>
  );
});

export default SettingsPanel;
