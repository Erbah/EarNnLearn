'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Database, Table, Zap, Loader2 } from 'lucide-react';
import { API_BASE_URL, api } from '@/lib/api';

const API = `${API_BASE_URL}/api/v1/admin`;

interface TableButtonProps {
  name: string;
  isActive: boolean;
  onClick: (name: string) => void;
}

const TableButton = React.memo(function TableButton({ name, isActive, onClick }: TableButtonProps) {
  const handleClick = useCallback(() => {
    onClick(name);
  }, [name, onClick]);

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
        isActive ? 'bg-primary text-black' : 'text-gray-400 hover:bg-white/5'
      }`}
    >
      <Table size={14} /> {name}
    </button>
  );
});

interface RealDatabaseInspectorProps {
  onClose: () => void;
}

export const RealDatabaseInspector = React.memo(function RealDatabaseInspector({ onClose }: RealDatabaseInspectorProps) {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any>(null);
  const [formattedRows, setFormattedRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`${API}/tables`).then(res => setTables(res.data)).catch(() => {});
  }, []);

  const loadTable = useCallback(async (name: string) => {
    setLoading(true);
    setSelectedTable(name);
    try {
      const res = await api.get(`${API}/tables/${name}`);
      const columns = res.data.columns || [];
      const data = res.data.data || [];
      setTableData(res.data);

      if (data.length >= 1000 && typeof window !== 'undefined' && window.Worker) {
        const worker = new Worker(new URL('../../workers/db.worker.ts', import.meta.url));
        worker.onmessage = (e) => {
          if (e.data.formattedData) {
            setFormattedRows(e.data.formattedData);
          } else {
            setFormattedRows(data.map((row: any) => {
              const formattedRow: any = {};
              columns.forEach((col: string) => {
                formattedRow[col] = String(row[col]);
              });
              return formattedRow;
            }));
          }
          worker.terminate();
        };
        worker.onerror = () => {
          setFormattedRows(data.map((row: any) => {
            const formattedRow: any = {};
            columns.forEach((col: string) => {
              formattedRow[col] = String(row[col]);
            });
            return formattedRow;
          }));
          worker.terminate();
        };
        worker.postMessage({ data, columns });
      } else {
        const formatted = data.map((row: any) => {
          const formattedRow: any = {};
          columns.forEach((col: string) => {
            formattedRow[col] = String(row[col]);
          });
          return formattedRow;
        });
        setFormattedRows(formatted);
      }
    } catch (e) {
      setFormattedRows([]);
    }
    setLoading(false);
  }, []);

  const handleRefresh = useCallback(() => {
    if (selectedTable) {
      loadTable(selectedTable);
    }
  }, [selectedTable, loadTable]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 md:p-8">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0A0C10] border border-white/10 w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-xl"><Database size={20} /></div>
            <div>
              <h3 className="text-xl font-bold text-white">System Database Explorer</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Live Production Table Audit</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors"><X size={24} /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r border-white/5 bg-black/20 overflow-y-auto p-4 space-y-2">
            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-2">Registered Tables</h4>
            {tables.map(t => (
              <TableButton
                key={t}
                name={t}
                isActive={selectedTable === t}
                onClick={loadTable}
              />
            ))}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col p-6">
            {!selectedTable ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-4">
                <Database size={48} className="opacity-20" />
                <p className="text-sm font-medium">Select a table from the directory to begin inspection</p>
              </div>
            ) : loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-primary gap-4">
                <Loader2 size={32} className="animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest">Querying Layer 1 Database...</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="text-primary">{selectedTable}</span>
                    <span className="text-xs text-gray-500 font-normal">({tableData?.data?.length || 0} rows cached)</span>
                  </h4>
                  <button onClick={handleRefresh} className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"><Zap size={16} /></button>
                </div>

                <div className="flex-1 overflow-auto border border-white/10 rounded-2xl bg-black/40 shadow-inner">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-white/5 sticky top-0 z-10">
                      <tr>
                        {tableData?.columns?.map((col: string) => (
                          <th key={col} className="px-4 py-3 font-bold text-gray-500 border-b border-white/10 uppercase tracking-tighter">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {formattedRows.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          {tableData.columns.map((col: string) => (
                            <td key={col} className="px-4 py-3 font-mono text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={row[col]}>
                              {row[col]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

export default RealDatabaseInspector;
