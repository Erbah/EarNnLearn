"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Settings, 
  ShoppingBag, 
  AlertTriangle, 
  Check, 
  X, 
  Loader2, 
  ShieldCheck, 
  TrendingUp, 
  Scale,
  RefreshCcw,
  BookOpen
} from "lucide-react";
import axios from "axios";
import { api } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";

const API = "/api/v1";

interface Product {
  id: string;
  seller_rid: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  stock: number;
  product_type: "PHYSICAL" | "DIGITAL";
  status: string;
  review_feedback: string | null;
  created_at: string;
}

interface Order {
  id: string;
  buyer_rid: string;
  product_id: string;
  quantity: number;
  total_price: number;
  shipping_address: string | null;
  shipping_status: string;
  tracking_code: string | null;
  buyer_confirmed: boolean;
  created_at: string;
}

interface ShopSetting {
  ai_rules_prompt: string;
  platform_commission: number;
}

export default function ShopPanel() {
  const [settings, setSettings] = useState<ShopSetting | null>(null);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Settings form state
  const [rulesPrompt, setRulesPrompt] = useState("");
  const [commission, setCommission] = useState("0.05");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Moderation state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adminFeedback, setAdminFeedback] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [modLoading, setModLoading] = useState(false);

  // Dispute resolution state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [disputeLoading, setDisputeLoading] = useState(false);

  const fetchAdminData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, pendingRes, ordersRes] = await Promise.all([
        api.get(`${API}/shop/admin/settings`, { signal }),
        api.get(`${API}/shop/admin/pending`, { signal }),
        api.get(`${API}/shop/admin/orders`, { signal })
      ]);
      setSettings(settingsRes.data);
      setRulesPrompt(settingsRes.data.ai_rules_prompt);
      setCommission(settingsRes.data.platform_commission.toString());
      setPendingProducts(pendingRes.data);
      setAllOrders(ordersRes.data);
    } catch (err) {
      if (axios.isCancel(err)) return;
      console.error(err);
      setError("Failed to load shop administration console details.");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchAdminData(controller.signal);
    return () => controller.abort();
  }, [fetchAdminData]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsSuccess(false);
    try {
      const res = await api.put(`${API}/shop/admin/settings`, {
        ai_rules_prompt: rulesPrompt,
        platform_commission: parseFloat(commission)
      });
      setSettings(res.data);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Failed to update shop settings");
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleManualModeration = async (approved: boolean) => {
    if (!selectedProduct) return;
    setModLoading(true);
    try {
      await api.post(`${API}/shop/admin/review/${selectedProduct.id}`, {
        approved: approved,
        review_feedback: adminFeedback || (approved ? "Approved by administrator." : "Rejected by administrator.")
      });
      setSelectedProduct(null);
      setAdminFeedback("");
      setActionType(null);
      fetchAdminData();
    } catch (err) {
      console.error(err);
      alert("Moderation action failed.");
    } finally {
      setModLoading(false);
    }
  };

  const handleResolveDispute = async (resolution: "release" | "refund") => {
    if (!selectedOrder) return;
    setDisputeLoading(true);
    try {
      await api.post(`${API}/shop/admin/orders/${selectedOrder.id}/resolve?resolution=${resolution}`);
      setSelectedOrder(null);
      fetchAdminData();
    } catch (err) {
      console.error(err);
      alert("Dispute resolution processing failed.");
    } finally {
      setDisputeLoading(false);
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case "RELEASED":
      case "DELIVERED":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "REFUNDED":
      case "CANCELLED":
        return "text-red-400 bg-red-500/10 border-red-500/20";
      case "ESCROWED":
      case "SHIPPED":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "DISPUTED":
        return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      default:
        return "text-gray-400 bg-white/5 border-white/10";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-400 bg-red-500/10 border border-red-500/20 rounded-3xl">
        {error}
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-8 items-start">
      {/* Left 2 Cols: Moderation and Order list */}
      <div className="lg:col-span-2 space-y-8">
        
        {/* Product Review Queue */}
        <div className="bg-card border border-white/5 p-6 rounded-3xl space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            Product Moderation Queue ({pendingProducts.length})
          </h2>
          <p className="text-xs text-gray-400 leading-normal">
            Moderate listings submitted by sellers. You can override AI-rejected listings if necessary.
          </p>

          {pendingProducts.length === 0 ? (
            <div className="p-12 text-center text-gray-500 border border-dashed border-white/10 rounded-2xl bg-card/30">
              <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              <p className="text-xs font-bold text-white">Queue is clear</p>
              <p className="text-[10px] mt-1">No products currently require review.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5 space-y-4">
              {pendingProducts.map(p => (
                <div key={p.id} className="pt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{p.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full border text-[9px] uppercase font-bold tracking-wider ${
                        p.status === "REJECTED" ? "text-red-400 border-red-500/20 bg-red-500/5" : "text-amber-400 border-amber-500/20 bg-amber-500/5"
                      }`}>
                        {p.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-1">{p.description}</p>
                    <p className="text-[10px] text-gray-500">Seller: <strong className="font-mono text-gray-400">{p.seller_rid}</strong> | Price: GHS {p.price} | Type: {p.product_type}</p>
                    {p.review_feedback && (
                      <p className="text-[10px] text-red-400 bg-red-500/5 p-2 rounded-lg border border-red-500/10 italic">
                        AI Flag: "{p.review_feedback}"
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
                    <button
                      onClick={() => { setSelectedProduct(p); setActionType("approve"); setAdminFeedback(""); }}
                      className="px-3.5 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-background transition-all border border-emerald-500/20 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => { setSelectedProduct(p); setActionType("reject"); setAdminFeedback(""); }}
                      className="px-3.5 py-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-500/20 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global Orders & Disputes */}
        <div className="bg-card border border-white/5 p-6 rounded-3xl space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-secondary" />
            Global Escrow Orders ({allOrders.length})
          </h2>
          <p className="text-xs text-gray-400 leading-normal">
            Track transaction records, escrow logs, and resolve disputed purchases using escrow arbitration overrides.
          </p>

          {allOrders.length === 0 ? (
            <div className="p-12 text-center text-gray-500 border border-dashed border-white/10 rounded-2xl bg-card/30">
              <p className="text-xs">No orders placed on the platform yet.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              {allOrders.map(order => (
                <div key={order.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] text-gray-500 font-mono">Order: #{order.id.slice(0, 8)}</span>
                      <span className={`px-2 py-0.5 rounded-full border text-[9px] uppercase font-bold tracking-wider ${getOrderStatusBadge(order.shipping_status)}`}>
                        {order.shipping_status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-300">
                      Buyer: <span className="font-mono">{order.buyer_rid}</span> | Total: <strong>GHS {order.total_price.toFixed(2)}</strong>
                    </div>
                  </div>

                  {order.shipping_status === "DISPUTED" && (
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-3.5 py-2 bg-rose-500 text-white font-bold rounded-xl text-xs hover:scale-102 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Scale className="w-4 h-4" />
                      Resolve Dispute
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Right 1 Col: Shop AI review Configuration */}
      <div className="bg-card border border-white/5 p-6 rounded-3xl space-y-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-secondary" />
          AI Reviewer Settings
        </h2>
        <p className="text-xs text-gray-400 leading-normal">
          Adjust the system parameters and prompt instructions used by the Gemini model to automatically approve or reject uploads.
        </p>

        <form onSubmit={handleUpdateSettings} className="space-y-5">
          {/* Rules prompt */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">AI Prompts / Rules *</label>
            <textarea
              required
              value={rulesPrompt}
              onChange={(e) => setRulesPrompt(e.target.value)}
              rows={6}
              className="w-full bg-background border border-white/10 rounded-xl p-3 focus:outline-none focus:border-secondary/50 text-white text-xs leading-relaxed"
            />
          </div>

          {/* Commission percentage */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Platform Commission (e.g. 0.05 = 5%)</label>
            <input
              type="number"
              step="0.005"
              min="0"
              max="1"
              required
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              className="w-full bg-background border border-white/10 rounded-xl p-3 focus:outline-none focus:border-secondary/50 text-white text-xs font-mono"
            />
          </div>

          {/* Messages */}
          {settingsSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Settings updated successfully!
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={settingsLoading}
            className="w-full py-3.5 bg-secondary text-white font-black rounded-xl text-xs uppercase tracking-widest hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {settingsLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Shop Settings"
            )}
          </button>
        </form>
      </div>

      {/* Manual Moderation Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-card border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative space-y-6"
            >
              <button
                onClick={() => { setSelectedProduct(null); setActionType(null); }}
                className="absolute top-6 right-6 p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <span className="text-[10px] uppercase font-bold text-primary tracking-widest block mb-1">Moderator Control</span>
                <h3 className="text-xl font-black text-white line-clamp-1">{actionType === "approve" ? "Approve Product" : "Reject Product"}</h3>
                <p className="text-xs text-gray-400 mt-1">Product Title: "{selectedProduct.title}"</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Review Comments / Notes</label>
                <textarea
                  value={adminFeedback}
                  onChange={(e) => setAdminFeedback(e.target.value)}
                  placeholder={actionType === "approve" ? "Approved for meeting catalog safety requirements..." : "Rejected for containing prohibited item keywords..."}
                  rows={3}
                  className="w-full bg-background border border-white/10 rounded-xl p-3 focus:outline-none focus:border-primary/50 text-white text-xs"
                />
              </div>

              <button
                onClick={() => handleManualModeration(actionType === "approve")}
                disabled={modLoading}
                className={`w-full py-4 font-black rounded-2xl text-xs uppercase tracking-widest hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  actionType === "approve" 
                    ? "bg-emerald-500 text-background hover:bg-emerald-400" 
                    : "bg-red-500 text-white hover:bg-red-400"
                }`}
              >
                {modLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Moderation Override"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resolve Dispute Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-card border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative space-y-6"
            >
              <button
                onClick={() => setSelectedOrder(null)}
                className="absolute top-6 right-6 p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto border border-rose-500/30">
                  <AlertTriangle className="w-8 h-8 text-rose-500 animate-bounce" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white">Escrow Arbitration</h3>
                  <p className="text-xs text-gray-400">Order Ref: #{selectedOrder.id.slice(0, 8)}</p>
                </div>

                <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                  Choose a resolution for this disputed transaction. Selecting a resolution will release the escrow pool and log the resulting transactions.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleResolveDispute("release")}
                  disabled={disputeLoading}
                  className="py-3 bg-emerald-500 text-background font-bold rounded-xl text-xs hover:bg-emerald-400 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Release to Seller
                </button>
                <button
                  onClick={() => handleResolveDispute("refund")}
                  disabled={disputeLoading}
                  className="py-3 bg-red-500 text-white font-bold rounded-xl text-xs hover:bg-red-400 transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-red-500/20"
                >
                  <X className="w-4 h-4" />
                  Refund to Buyer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
