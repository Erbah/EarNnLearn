"use client";

import { useState, useEffect } from "react";
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
  Plus
} from "lucide-react";

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
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [addAmount, setAddAmount] = useState(100);
  const [withdrawAmount, setWithdrawAmount] = useState(50);
  const [payoutMethod, setPayoutMethod] = useState("Mobile Money (MTN)");
  const [payoutDetails, setPayoutDetails] = useState("");

  useEffect(() => {
    fetchWalletData();
  }, []);

  async function fetchWalletData() {
    setLoading(true);
    setError(null);
    try {
      const [wRes, tRes, wdRes] = await Promise.all([
        api.get(`${API}/wallet/`),
        api.get(`${API}/wallet/transactions`),
        api.get(`${API}/wallet/withdrawals/my`)
      ]);

      setWallet(wRes.data);
      setTransactions(tRes.data);
      setWithdrawals(wdRes.data);
    } catch (err) {
      setError("Failed to load wallet. Please ensure you have activated your account.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

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
    try {
      const res = await api.post(`${API}/wallet/withdraw`, {
        amount: withdrawAmount,
        payout_method: payoutMethod,
        payout_details: { account: payoutDetails }
      });

      if (res.status === 200) {
        alert("Withdrawal request submitted!");
        setShowWithdrawModal(false);
        fetchWalletData();
      } else {
        const err = res.data;
        const detail = err.detail;
        let errMsg = "Unknown error";
        if (Array.isArray(detail)) {
          errMsg = detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ");
        } else if (typeof detail === 'string') {
          errMsg = detail;
        } else if (detail) {
          errMsg = JSON.stringify(detail);
        }
        alert(`Error: ${errMsg}`);
      }
    } catch (err) {
      alert("Failed to submit request");
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
                          <div className="font-bold text-sm text-white">{w.amount} GHS</div>
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
            className="bg-card border border-white/10 w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6"
          >
            <div className="flex justify-between items-center text-white">
              <h3 className="text-xl font-bold">Request Withdrawal</h3>
              <button onClick={() => setShowWithdrawModal(false)} className="p-2 hover:bg-white/5 rounded-full text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Amount (GHS)</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(+e.target.value)}
                  aria-label="Withdrawal Amount"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  placeholder="Min. 50 GHS"
                />
                <p className="text-[10px] text-gray-500 mt-2">Available for withdrawal: <span className="text-emerald-500 font-bold">{wallet?.withdrawable_balance} GHS</span></p>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Payout Method</label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  title="Select Payout Method"
                  aria-label="Select Payout Method"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-primary appearance-none cursor-pointer"
                >
                  <option value="Mobile Money (MTN)" className="bg-card">Mobile Money (MTN)</option>
                  <option value="Mobile Money (Telecel)" className="bg-card">Mobile Money (Telecel)</option>
                  <option value="Bank Transfer" className="bg-card">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Payment Details (Phone/Account)</label>
                <input
                  type="text"
                  value={payoutDetails}
                  onChange={(e) => setPayoutDetails(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  placeholder="Enter number or account number"
                />
              </div>

              <button
                onClick={handleWithdraw}
                disabled={withdrawAmount < 50 || withdrawAmount > (wallet?.withdrawable_balance || 0)}
                className="w-full bg-primary text-background py-4 rounded-2xl font-bold hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 mt-4"
              >
                Submit Request
              </button>
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
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Amount (GHS)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={addAmount}
                    onChange={(e) => setAddAmount(+e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-primary text-2xl font-bold"
                    placeholder="50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">GHS</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[50, 100, 500].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setAddAmount(amt)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${addAmount === amt ? 'bg-primary text-background' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'}`}
                  >
                    {amt} GHS
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
