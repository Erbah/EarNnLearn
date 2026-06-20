'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL, api } from '@/lib/api';
import axios from 'axios';

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

  const loadSettings = useCallback((signal?: AbortSignal) => {
    api.get(`${API}/settings`, { signal }).then(res => setSettings(res.data)).catch((err) => {
      if (axios.isCancel(err)) return;
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadSettings(controller.signal);
    return () => controller.abort();
  }, [loadSettings]);

  const save = useCallback(async (key: string) => {
    // Save the directly edited setting
    await api.put(`${API}/settings/${key}`, { value: editVal });
    let updatedSettings = settings.map(s => s.key === key ? { ...s, value: editVal } : s);

    // Auto-balance logic for profit shares
    if (['seller_percentage', 'master_percentage', 'family_percentage'].includes(key)) {
      const seller = parseFloat(updatedSettings.find(s => s.key === 'seller_percentage')?.value || '0');
      const master = parseFloat(updatedSettings.find(s => s.key === 'master_percentage')?.value || '0');
      const family = parseFloat(updatedSettings.find(s => s.key === 'family_percentage')?.value || '0');
      
      let keyToAutoAdjust = '';
      let remaining = 0;
      
      if (key === 'seller_percentage' || key === 'master_percentage') {
          keyToAutoAdjust = 'family_percentage';
          remaining = Math.max(0, 1.0 - seller - master);
      } else if (key === 'family_percentage') {
          // If family is edited, we auto-adjust seller share
          keyToAutoAdjust = 'seller_percentage';
          remaining = Math.max(0, 1.0 - family - master);
      }
      
      if (keyToAutoAdjust) {
          const formattedRemaining = remaining.toFixed(2);
          await api.put(`${API}/settings/${keyToAutoAdjust}`, { value: formattedRemaining });
          updatedSettings = updatedSettings.map(s => s.key === keyToAutoAdjust ? { ...s, value: formattedRemaining } : s);
      }
    }

    setSettings(updatedSettings);
    setEditing(null);
  }, [editVal, settings]);

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

  // Calculate visual distribution percentages
  const sellerShare = parseFloat(settings.find(s => s.key === 'seller_percentage')?.value || '0');
  const masterShare = parseFloat(settings.find(s => s.key === 'master_percentage')?.value || '0');
  const familyShare = parseFloat(settings.find(s => s.key === 'family_percentage')?.value || '0');
  const totalShare = sellerShare + masterShare + familyShare;
  
  const getWidth = (val: number) => totalShare > 0 ? `${(val / totalShare) * 100}%` : '0%';

  return (
    <div style={SETTINGS_BOX_STYLE}>
      <div className="mb-8 p-6 bg-black/20 rounded-2xl border border-white/5 relative overflow-hidden">
        <h4 className="text-white font-bold mb-1 flex items-center gap-2">
          📊 Profit Distribution Matrix
        </h4>
        <p className="text-xs text-gray-400 mb-5">
          Editing one percentage automatically calculates and balances the others to ensure they perfectly evaluate to 100%.
        </p>
        
        {/* Colorful Distribution Bar */}
        <div className="flex h-6 rounded-full overflow-hidden mb-4 shadow-inner bg-white/5">
          <div style={{ width: getWidth(sellerShare) }} className="bg-emerald-500 transition-all duration-500 flex items-center justify-center text-[10px] font-bold text-black overflow-hidden whitespace-nowrap">
            {sellerShare > 0.05 && `Seller (${(sellerShare*100).toFixed(0)}%)`}
          </div>
          <div style={{ width: getWidth(familyShare) }} className="bg-blue-500 transition-all duration-500 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden whitespace-nowrap">
            {familyShare > 0.05 && `Family (${(familyShare*100).toFixed(0)}%)`}
          </div>
          <div style={{ width: getWidth(masterShare) }} className="bg-amber-500 transition-all duration-500 flex items-center justify-center text-[10px] font-bold text-black overflow-hidden whitespace-nowrap">
            {masterShare > 0.05 && `Platform (${(masterShare*100).toFixed(0)}%)`}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-6 text-xs font-medium">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span><span className="text-gray-300">Seller ({sellerShare})</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span><span className="text-gray-300">Family ({familyShare})</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span><span className="text-gray-300">Platform ({masterShare})</span></div>
          <div className="ml-auto text-primary font-bold">Total: {(totalShare * 100).toFixed(0)}%</div>
        </div>
      </div>

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
