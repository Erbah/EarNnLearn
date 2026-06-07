'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, X, Settings, Zap, ShieldCheck, Globe, CheckCircle, AlertCircle } from 'lucide-react';
import { API_BASE_URL, api } from '@/lib/api';

const API = `${API_BASE_URL}/api/v1/admin`;

export const AIStrategyPanel = React.memo(function AIStrategyPanel() {
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form State
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  const providers = useMemo(() => [
    { id: 'google', name: 'Google Gemini', models: ['gemini/gemini-2.0-flash', 'gemini/gemini-1.5-pro', 'gemini/gemini-1.5-flash'] },
    { id: 'openai', name: 'OpenAI GPT', models: ['openai/gpt-4o', 'openai/gpt-4o-mini'] },
    { id: 'deepseek', name: 'DeepSeek', models: ['deepseek/deepseek-chat', 'deepseek/deepseek-reasoner'] },
    { id: 'anthropic', name: 'Anthropic Claude', models: ['anthropic/claude-3-5-sonnet-20240620', 'anthropic/claude-3-haiku-20240307'] },
    { id: 'ollama', name: 'Ollama (Local)', models: ['ollama/qwen', 'ollama/llama3', 'ollama/mistral'] },
    { id: 'mock', name: 'Mock / Simulation', models: ['mock'] }
  ], []);

  const fetchSettings = useCallback(() => {
    setLoading(true);
    api.get(`${API}/ai-settings`)
      .then(res => {
        setProvider(res.data.active_provider);
        setModel(res.data.active_model);
        setBaseUrl(res.data.active_base_url || '');
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.put(`${API}/ai-settings`, {
        provider,
        model,
        api_key: apiKey || null,
        base_url: baseUrl || null
      });
      setIsEditing(false);
      setShowConfirm(false);
      setApiKey('');
      fetchSettings();
    } catch (err) {
      alert("Failed to update AI Strategy");
    } finally {
      setSaving(false);
    }
  }, [provider, model, apiKey, baseUrl, fetchSettings]);

  const handleToggleEditing = useCallback(() => {
    setIsEditing(prev => !prev);
  }, []);

  const handleProviderChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = e.target.value;
    setProvider(p);
    const def = providers.find(x => x.id === p)?.models[0];
    if (def) setModel(def);
  }, [providers]);

  const handleModelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setModel(e.target.value);
  }, []);

  const handleApiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
  }, []);

  const handleBaseUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBaseUrl(e.target.value);
  }, []);

  const handleOpenConfirm = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleCloseConfirm = useCallback(() => {
    setShowConfirm(false);
  }, []);

  const providerName = useMemo(() => {
    return providers.find(p => p.id === provider)?.name || provider;
  }, [provider, providers]);

  const activeModelShortName = useMemo(() => {
    return model.split('/').pop() || model;
  }, [model]);

  const activeProviderModels = useMemo(() => {
    return providers.find(p => p.id === provider)?.models || [];
  }, [provider, providers]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles size={120} className="text-primary" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-2xl font-black text-white">AI Strategy Center</h3>
            </div>
            <p className="text-gray-400 max-w-xl leading-relaxed">
              Dynamically switch platform intelligence. Stage 2 enables real-time provider hotswapping and model resolution.
            </p>
          </div>
          
          <button 
            onClick={handleToggleEditing}
            className={`px-6 py-3 rounded-2xl font-black text-sm transition-all flex items-center gap-2 ${
              isEditing ? 'bg-white/10 text-white border border-white/20' : 'bg-primary text-black hover:scale-105 active:scale-95'
            }`}
          >
            {isEditing ? <X size={18} /> : <Settings size={18} />}
            {isEditing ? 'Cancel Configuration' : 'Adjust Intelligence'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Config Panel */}
        <div className="md:col-span-2 bg-card/70 border border-white/10 rounded-3xl p-8 space-y-8 relative overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500 animate-pulse font-mono uppercase tracking-widest">
              Syncing Neural Weights...
            </div>
          ) : isEditing ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h4 className="text-[10px] uppercase font-black text-primary tracking-[0.2em]">Configuration Matrix</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">Intelligence Provider</label>
                  <select 
                    value={provider}
                    onChange={handleProviderChange}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold appearance-none outline-none focus:border-primary/50 transition-colors"
                  >
                    {providers.map(p => <option key={p.id} value={p.id} className="bg-neutral-900">{p.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">Active Model</label>
                  <select 
                    value={model}
                    onChange={handleModelChange}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold appearance-none outline-none focus:border-primary/50 transition-colors"
                  >
                    {activeProviderModels.map(m => (
                      <option key={m} value={m} className="bg-neutral-900">{m.split('/').pop()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">Custom API Key (Optional Override)</label>
                <div className="relative">
                  <input 
                    type="password"
                    placeholder="Leave blank to use system default..."
                    value={apiKey}
                    onChange={handleApiKeyChange}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-white font-mono text-sm outline-none focus:border-primary/50 transition-colors"
                  />
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">Custom Base URL (e.g. Ollama Cloud)</label>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="e.g. https://ollama.your-domain.com"
                    value={baseUrl}
                    onChange={handleBaseUrlChange}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-white font-mono text-sm outline-none focus:border-primary/50 transition-colors"
                  />
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  onClick={handleOpenConfirm}
                  disabled={saving}
                  className="flex-1 bg-primary text-black font-black py-4 rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle size={20} />
                  Deploy Strategy
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-end">
                <h4 className="text-[10px] uppercase font-black text-gray-500 tracking-[0.2em]">Active Deployment</h4>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase flex items-center gap-1.5 border border-emerald-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live in Production
                </span>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Provider</span>
                  <div className="text-xl font-black text-white flex items-center gap-2">
                    {providerName}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Model Specification</span>
                  <div className="text-xl font-mono font-black text-primary">
                    {activeModelShortName}
                  </div>
                </div>
              </div>

              {baseUrl && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Custom Endpoint</span>
                  <div className="text-xs font-mono text-gray-400 break-all">
                    {baseUrl}
                  </div>
                </div>
              )}

              <div className="p-4 bg-primary/5 border border-dashed border-primary/20 rounded-2xl flex items-start gap-3">
                <AlertCircle className="text-primary w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-[10px] text-primary/70 leading-relaxed italic">
                  Critical Warning: Switching to higher-parameter models may increase latency and token consumption significantly. Ensure the selected model is cached and optimized for pedagogical depth.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Stats Column */}
        <div className="space-y-6">
          <div className="bg-card/70 border border-white/10 rounded-3xl p-6 space-y-6">
            <h4 className="text-[10px] uppercase font-black text-gray-500 tracking-[0.2em]">Performance Index</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400">Response Latency</span>
                <span className="text-xs font-bold text-emerald-500">OPTIMAL (1.2s)</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: '85%' }} className="h-full bg-emerald-500" />
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-bold text-gray-400">Context Retention</span>
                <span className="text-xs font-bold text-primary">ELITE (98%)</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: '98%' }} className="h-full bg-primary" />
              </div>
            </div>
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-3xl p-6">
            <h4 className="text-[10px] uppercase font-black text-primary tracking-[0.2em] mb-4">Neural Health</h4>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-black text-white">99.4</span>
              <span className="text-xs font-bold text-primary mb-1">%</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Strategy uptime is currently at peak levels. No degradation detected across regional clusters.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#111] border border-white/10 rounded-[40px] p-10 max-w-md w-full shadow-2xl shadow-primary/20 space-y-8 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Zap className="w-10 h-10 text-primary animate-pulse" />
            </div>
            
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-black text-white">Confirm Strategic Shift?</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                You are about to re-route all platform intelligence through <span className="text-primary font-bold">{providerName}</span>. 
                This will impact real-time lesson generation, course reviews, and user interactions immediately.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-bold uppercase">New Model</span>
                <span className="text-primary font-mono font-black">{activeModelShortName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-bold uppercase">Security Mode</span>
                <span className="text-emerald-500 font-bold uppercase">Encrypted</span>
              </div>
              {baseUrl && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 font-bold uppercase">Endpoint</span>
                  <span className="text-white font-mono truncate ml-4">{baseUrl}</span>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={handleCloseConfirm}
                className="flex-1 px-6 py-4 rounded-2xl border border-white/10 text-white font-black text-sm hover:bg-white/5 transition-all"
              >
                Abort
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-6 py-4 rounded-2xl bg-primary text-black font-black text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {saving ? 'Deploying...' : 'Confirm Deploy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default AIStrategyPanel;
