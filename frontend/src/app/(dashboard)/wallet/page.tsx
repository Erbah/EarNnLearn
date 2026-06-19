"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  TrendingUp,
  CreditCard,
  RefreshCcw,
  ShieldCheck,
  X,
  Plus,
  ChevronDown,
  Smartphone,
  Landmark
} from "lucide-react";
import axios from "axios";

import { useUser } from "@/context/UserContext";
import { API_BASE_URL, api } from "@/lib/api";

const API = `${API_BASE_URL}/api/v1`;

interface WalletData {
  balance: number;
  withdrawable_balance: number;
  locked_balance: number;
  currency: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  payout_method: string;
  created_at: string;
}

export default function WalletPage() {
  const { user } = useUser();
  const minW = user?.min_withdrawal || 50;
  
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [addAmount, setAddAmount] = useState(100);
  const [withdrawAmount, setWithdrawAmount] = useState(minW);
  const [bankCode, setBankCode] = useState("MTN");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [payoutType, setPayoutType] = useState<'momo' | 'bank'>('momo');

  const fetchWalletData = useCallback(async (signal?: any) => {
    const abortSignal = signal instanceof AbortSignal ? signal : undefined;
    setLoading(true);
    setError(null);
    try {
      const [wRes, tRes, wdRes] = await Promise.all([
        api.get(`${API}/wallet/`, { signal: abortSignal }),
        api.get(`${API}/wallet/transactions`, { signal: abortSignal }),
        api.get(`${API}/wallet/withdrawals/my`, { signal: abortSignal })
      ]);

      setWallet(wRes.data);
      setTransactions(tRes.data);
      setWithdrawals(wdRes.data);
    } catch (err) {
      if (axios.isCancel(err)) return;
      setError("Failed to load wallet. Please ensure you have activated your account.");
      console.error(err);
    } finally {
      if (!abortSignal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchWalletData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchWalletData]);

  async function handleDeposit() {
    try {
      const res = await api.post(`${API}/wallet/deposit`, {
        amount: addAmount
      });

      if (res.data.authorization_url) {
        // Redirect to Paystack
        window.location.href = res.data.authorization_url;
      } else {
        alert("Failed to initialize deposit");
      }
    } catch (err) {
      alert("Error initializing deposit");
      console.error(err);
    }
  }

  async function handleWithdraw() {
    const isMomo = payoutType === 'momo';
    if (!accountName.trim() || !accountNumber.trim()) {
      setWithdrawError("Please fill in all fields.");
      return;
    }
    if (isMomo && accountNumber.length < 10) {
      setWithdrawError("MoMo number must be 10 digits.");
      return;
    }
    if (!isMomo && accountNumber.length < 5) {
      setWithdrawError("Please enter a valid bank account number.");
      return;
    }
    setSubmittingWithdrawal(true);
    setWithdrawError(null);
    try {
      const res = await api.post(`${API}/wallet/withdraw`, {
        amount: withdrawAmount,
        payout_method: "paystack",
        payout_details: { 
          name: accountName.trim(),
          account_number: accountNumber.trim(),
          bank_code: bankCode,
          recipient_type: isMomo ? 'mobile_money' : 'ghipss'
        }
      });

      if (res.status === 200) {
        setShowWithdrawModal(false);
        setAccountNumber("");
        setAccountName("");
        setWithdrawAmount(minW);
        setWithdrawError(null);
        fetchWalletData();
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      let errMsg = "Failed to submit withdrawal request. Please try again.";
      if (Array.isArray(detail)) {
        errMsg = detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ");
      } else if (typeof detail === 'string') {
        errMsg = detail;
      }
      setWithdrawError(errMsg);
    } finally {
      setSubmittingWithdrawal(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCcw className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Financial Hub</h1>
          <p className="text-gray-400">Manage your earnings and network commissions.</p>
        </div>
        <button
          onClick={fetchWalletData}
          className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
        >
          <RefreshCcw className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
        </button>
      </div>

      {error ? (
        <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
          <ShieldCheck className="w-12 h-12 text-red-500 mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold text-white mb-2">Action Required</h2>
          <p className="text-gray-400 mb-6">{typeof error === 'string' ? error : JSON.stringify(error)}</p>
          <a href="/activate" className="px-6 py-2 bg-primary text-background font-bold rounded-lg hover:scale-105 transition-transform inline-block">
            Activate Account
          </a>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-3xl bg-gradient-to-br from-primary/20 to-blue-600/10 border border-primary/20 glass relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <Wallet className="w-24 h-24 text-primary" />
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-primary/20 text-primary">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-primary uppercase tracking-wider">Total Balance</span>
                </div>
                <button
                  onClick={() => setShowAddFundsModal(true)}
                  className="p-1 px-3 bg-primary text-background text-[10px] font-bold rounded-lg hover:scale-105 transition-transform flex items-center gap-1 uppercase tracking-widest"
                >
                  <Plus className="w-3 h-3" /> Add Funds
                </button>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-bold text-white">{wallet?.balance}</span>
                <span className="text-lg font-medium text-gray-500">{wallet?.currency}</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-6 rounded-3xl bg-white/5 border border-white/10 glass"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-green-500/20 text-green-500">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Withdrawable</span>
                </div>
                <button
                  onClick={() => setShowWithdrawModal(true)}
                  disabled={(wallet?.withdrawable_balance || 0) <= 0}
                  title="Withdraw Funds"
                  aria-label="Withdraw Funds"
                  className="px-3 py-1 bg-primary text-background text-[10px] font-bold rounded-lg hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 uppercase tracking-widest"
                >
                  Withdraw
                </button>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-white">{wallet?.withdrawable_balance}</span>
                <span className="text-sm font-medium text-gray-500">{wallet?.currency}</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-6 rounded-3xl bg-white/5 border border-white/10 glass"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 rounded-lg bg-secondary/20 text-secondary">
                  <History className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Locked (Escrow)</span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-white">{wallet?.locked_balance}</span>
                <span className="text-sm font-medium text-gray-500">{wallet?.currency}</span>
              </div>
            </motion.div>
          </div>

          {/* Transactions Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-3xl border border-white/10 bg-card overflow-hidden glass"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Recent Transactions</h3>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <History className="w-4 h-4" />
                <span>Last 30 days</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5 text-xs uppercase font-bold text-gray-500 tracking-wider">
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                        No transactions yet. Start learning to earn!
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${tx.type.includes("CREDIT") ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                              {tx.type.includes("CREDIT") ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                            </div>
                            <span className="font-medium text-white">{tx.type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-400 group-hover:text-gray-300 transition-colors uppercase text-xs">
                          {tx.description}
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${tx.type.includes("CREDIT") ? "text-green-500" : "text-red-500"}`}>
                          {tx.type.includes("CREDIT") ? "+" : "-"}{tx.amount}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-500 group-hover:text-gray-400 transition-colors">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Withdrawal History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-3xl border border-white/10 bg-card overflow-hidden glass"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Withdrawal History</h3>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>

            <div className="p-6">
              {withdrawals.length === 0 ? (
                <div className="py-8 text-center text-gray-500 italic text-sm">No withdrawal requests yet.</div>
              ) : (
                <div className="space-y-4">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl ${w.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-500' :
                          w.status === 'REJECTED' ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-500'
                          }`}>
                          <RefreshCcw className={`w-4 h-4 ${w.status === 'PENDING' ? 'animate-spin-slow' : ''}`} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white">{w.amount} {wallet?.currency || user?.default_currency || 'GHS'}</div>
                          <div className="text-[10px] text-gray-500 uppercase tracking-widest">{w.payout_method} • {new Date(w.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${w.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' :
                        w.status === 'REJECTED' ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500'
                        }`}>
                        {w.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md p-4">
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-card border border-white/10 w-full max-w-md rounded-3xl shadow-2xl p-6 lg:p-8 space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center text-white">
              <div>
                <h3 className="text-xl font-bold">Withdraw Funds</h3>
                <p className="text-xs text-gray-500 mt-1">Choose your preferred withdrawal method</p>
              </div>
              <button onClick={() => { setShowWithdrawModal(false); setWithdrawError(null); }} className="p-2 hover:bg-white/5 rounded-full text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            {/* MoMo / Bank Tab Switcher */}
            <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10">
              <button
                onClick={() => { setPayoutType('momo'); setBankCode('MTN'); setAccountNumber(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  payoutType === 'momo' ? 'bg-primary text-background shadow-lg' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                Mobile Money
              </button>
              <button
                onClick={() => { setPayoutType('bank'); setBankCode(''); setAccountNumber(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  payoutType === 'bank' ? 'bg-primary text-background shadow-lg' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Landmark className="w-4 h-4" />
                Bank Account
              </button>
            </div>

            {withdrawError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{withdrawError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Provider / Bank Select */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">
                  {payoutType === 'momo' ? 'Mobile Network' : 'Bank'}
                </label>
                <div className="relative">
                  <select
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                    title={payoutType === 'momo' ? 'Select Network' : 'Select Bank'}
                    aria-label={payoutType === 'momo' ? 'Select Network' : 'Select Bank'}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-12 text-white focus:outline-none focus:border-primary appearance-none cursor-pointer"
                  >
                    {payoutType === 'momo' ? (
                      <>
                        <option value="MTN" className="bg-card">MTN Mobile Money</option>
                        <option value="VOD" className="bg-card">Telecel (Vodafone) Cash</option>
                        <option value="ATL" className="bg-card">AirtelTigo Money</option>
                      </>
                    ) : (
                      <>
                        <option value="" className="bg-card" disabled>Select a bank...</option>
                        <option value="030100" className="bg-card">Absa Bank Ghana</option>
                        <option value="280100" className="bg-card">Access Bank Ghana</option>
                        <option value="080100" className="bg-card">ADB Bank Limited</option>
                        <option value="070101" className="bg-card">ARB Apex Bank</option>
                        <option value="210100" className="bg-card">Bank of Africa Ghana</option>
                        <option value="140100" className="bg-card">CAL Bank Limited</option>
                        <option value="340100" className="bg-card">Consolidated Bank Ghana</option>
                        <option value="130100" className="bg-card">Ecobank Ghana</option>
                        <option value="200100" className="bg-card">FBNBank Ghana</option>
                        <option value="240100" className="bg-card">Fidelity Bank Ghana</option>
                        <option value="170100" className="bg-card">First Atlantic Bank</option>
                        <option value="330100" className="bg-card">First National Bank Ghana</option>
                        <option value="040100" className="bg-card">GCB Bank Limited</option>
                        <option value="230100" className="bg-card">Guaranty Trust Bank (Ghana)</option>
                        <option value="050100" className="bg-card">National Investment Bank</option>
                        <option value="360100" className="bg-card">OmniBSCI Bank</option>
                        <option value="180100" className="bg-card">Prudential Bank</option>
                        <option value="110100" className="bg-card">Republic Bank Ghana</option>
                        <option value="090100" className="bg-card">Société Générale Ghana</option>
                        <option value="190100" className="bg-card">Stanbic Bank Ghana</option>
                        <option value="020100" className="bg-card">Standard Chartered Bank Ghana</option>
                        <option value="060100" className="bg-card">United Bank for Africa Ghana</option>
                        <option value="100100" className="bg-card">Universal Merchant Bank</option>
                        <option value="120100" className="bg-card">Zenith Bank Ghana</option>
                      </>
                    )}
                  </select>
                  <ChevronDown className="w-5 h-5 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Account Number */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">
                  {payoutType === 'momo' ? 'MoMo Number' : 'Account Number'}
                </label>
                <input
                  type={payoutType === 'momo' ? 'tel' : 'text'}
                  value={accountNumber}
                  onChange={(e) => {
                    if (payoutType === 'momo') {
                      setAccountNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 10));
                    } else {
                      setAccountNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 16));
                    }
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  placeholder={payoutType === 'momo' ? 'e.g. 0241234567' : 'e.g. 1234567890123'}
                  maxLength={payoutType === 'momo' ? 10 : 16}
                />
              </div>

              {/* Account Name */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Account Holder Name</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  placeholder={payoutType === 'momo' ? 'Name on MoMo account' : 'Name on bank account'}
                />
              </div>

              {/* Amount */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Amount ({wallet?.currency || 'GHS'})</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(+e.target.value)}
                  aria-label="Withdrawal Amount"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  placeholder={`Min. ${minW}`}
                  min={minW}
                />
                <div className="flex justify-between mt-2">
                  <p className="text-[10px] text-gray-500">Available: <span className="text-emerald-500 font-bold">{wallet?.withdrawable_balance} {wallet?.currency || 'GHS'}</span></p>
                  <p className="text-[10px] text-gray-500">Min: <span className="font-bold text-gray-400">{minW} {wallet?.currency || 'GHS'}</span></p>
                </div>
              </div>

              {/* Fee Breakdown */}
              {withdrawAmount >= minW && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2"
                >
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Withdrawal</span>
                    <span className="text-white font-medium">{withdrawAmount.toFixed(2)} {wallet?.currency || 'GHS'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Processing Fee</span>
                    <span className="text-orange-400 font-medium">-{user?.withdrawal_fee || 2.00} {wallet?.currency || 'GHS'}</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex justify-between text-sm">
                    <span className="text-gray-300 font-bold">You Receive</span>
                    <span className="text-emerald-400 font-bold">{(withdrawAmount - (user?.withdrawal_fee || 2.00)).toFixed(2)} {wallet?.currency || 'GHS'}</span>
                  </div>
                </motion.div>
              )}

              <button
                onClick={handleWithdraw}
                disabled={
                  submittingWithdrawal ||
                  withdrawAmount < minW ||
                  withdrawAmount > (wallet?.withdrawable_balance || 0) ||
                  !accountNumber.trim() ||
                  (payoutType === 'momo' && accountNumber.length < 10) ||
                  (payoutType === 'bank' && accountNumber.length < 5) ||
                  !accountName.trim() ||
                  !bankCode
                }
                className="w-full bg-primary text-background py-4 rounded-2xl font-bold hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 mt-2 flex items-center justify-center gap-2"
              >
                {submittingWithdrawal ? (
                  <>
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Withdraw to ${payoutType === 'momo' ? 'Mobile Money' : 'Bank Account'}`
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest">
                <ShieldCheck className="w-3 h-3" />
                Processed via Paystack Transfer
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Funds Modal */}
      {showAddFundsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md p-4">
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-card border border-white/10 w-full max-w-sm rounded-3xl shadow-2xl p-8 space-y-6"
          >
            <div className="flex justify-between items-center text-white">
              <h3 className="text-xl font-bold">Add Funds</h3>
              <button onClick={() => setShowAddFundsModal(false)} className="p-2 hover:bg-white/5 rounded-full text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            <p className="text-gray-400 text-sm">Initialize a secure deposit via Paystack to fund your learning wallet.</p>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Amount ({wallet?.currency || user?.default_currency || 'GHS'})</label>
                <div className="relative">
                  <input
                    type="number"
                    value={addAmount}
                    onChange={(e) => setAddAmount(+e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-primary text-2xl font-bold"
                    placeholder="50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">{wallet?.currency || user?.default_currency || 'GHS'}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[50, 100, 500].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setAddAmount(amt)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${addAmount === amt ? 'bg-primary text-background' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'}`}
                  >
                    {amt} {wallet?.currency || user?.default_currency || 'GHS'}
                  </button>
                ))}
              </div>

              <button
                onClick={handleDeposit}
                disabled={addAmount < 1}
                className="w-full bg-primary text-background py-4 rounded-2xl font-bold hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 mt-4"
              >
                Proceed to Payment <ArrowUpRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest">
                <ShieldCheck className="w-3 h-3" />
                Secured by Paystack
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
