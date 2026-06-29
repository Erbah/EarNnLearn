"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Store, 
  Plus, 
  ShoppingBag, 
  ClipboardList, 
  Truck, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ArrowUpRight, 
  Clock, 
  ShieldAlert, 
  PackageCheck,
  Download
} from "lucide-react";
import axios from "axios";
import { api } from "@/lib/api";

const API = "/api/v1";

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  stock: number;
  product_type: "PHYSICAL" | "DIGITAL";
  category: string;
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

const formatPrice = (val: any) => {
  const num = Number(val);
  return isNaN(num) ? "0.00" : num.toFixed(2);
};

export default function SellerStudioPage() {
  const [activeTab, setActiveTab] = useState<"listings" | "sales">("listings");
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [mySales, setMySales] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Product Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("10.00");
  const [newType, setNewType] = useState<"PHYSICAL" | "DIGITAL">("PHYSICAL");
  const [newCategory, setNewCategory] = useState("other");
  const [newStock, setNewStock] = useState(5);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Ship Order Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingCode, setTrackingCode] = useState("");
  const [shipLoading, setShipLoading] = useState(false);
  const [shipError, setShipError] = useState<string | null>(null);

  const fetchSellerData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [listingsRes, salesRes] = await Promise.all([
        api.get(`${API}/shop/products/my-listings`, { signal }),
        api.get(`${API}/shop/orders/seller`, { signal })
      ]);
      setMyProducts(listingsRes.data);
      setMySales(salesRes.data);
    } catch (err) {
      if (axios.isCancel(err)) return;
      console.error(err);
      setError("Failed to load seller dashboard details.");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchSellerData(controller.signal);
    return () => controller.abort();
  }, [fetchSellerData]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || newDesc.length < 10) {
      setFormError("Please verify your input fields. Description must be at least 10 characters.");
      return;
    }

    setFormLoading(true);
    setFormError(null);
    try {
      await api.post(`${API}/shop/products`, {
        title: newTitle,
        description: newDesc,
        price: parseFloat(newPrice),
        product_type: newType,
        category: newCategory,
        stock: newStock
      });

      setShowAddModal(false);
      // Reset form
      setNewTitle("");
      setNewDesc("");
      setNewPrice("10.00");
      setNewType("PHYSICAL");
      setNewCategory("other");
      setNewStock(5);
      
      // Reload
      fetchSellerData();
    } catch (err: any) {
      console.error(err);
      setFormError(err.response?.data?.detail || "Failed to create product listing.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleShipOrder = async () => {
    if (!selectedOrder || !trackingCode.trim()) {
      setShipError("Please enter a valid shipment tracking number.");
      return;
    }

    setShipLoading(true);
    setShipError(null);
    try {
      await api.post(`${API}/shop/orders/${selectedOrder.id}/ship`, {
        tracking_code: trackingCode
      });
      setSelectedOrder(null);
      setTrackingCode("");
      fetchSellerData();
    } catch (err: any) {
      console.error(err);
      setShipError(err.response?.data?.detail || "Failed to ship order.");
    } finally {
      setShipLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
      case "ADMIN_APPROVED":
      case "RELEASED":
      case "DELIVERED":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "REJECTED":
      case "ADMIN_REJECTED":
      case "REFUNDED":
      case "CANCELLED":
        return "text-red-400 bg-red-500/10 border-red-500/20";
      case "PENDING_AI_REVIEW":
      case "ESCROWED":
      case "SHIPPED":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "DISPUTED":
      case "FROZEN":
        return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      default:
        return "text-gray-400 bg-white/5 border-white/10";
    }
  };

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border border-white/5 p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-secondary/10 rounded-full blur-[80px] -z-10" />
        
        <div>
          <div className="flex items-center gap-2 text-secondary text-xs uppercase font-extrabold tracking-widest mb-1.5">
            <Store className="w-4 h-4 animate-pulse" />
            Seller Studio
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-2">Merchant & P2P Center</h1>
          <p className="text-gray-400 text-sm max-w-md">
            Manage your shop listings, view real-time AI moderation reports, and track incoming escrow orders.
          </p>
        </div>

        {/* Add Product Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-4 bg-secondary text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:scale-[1.02] shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create New Listing
        </button>
      </div>

      {/* Tabs Selector */}
      <div className="flex gap-1 bg-slate-900/60 p-1.5 rounded-2xl border border-white/10 w-fit">
        <button
          onClick={() => setActiveTab("listings")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "listings" 
              ? "bg-secondary text-white shadow-lg" 
              : "text-gray-400 hover:text-white"
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          My Product Catalog ({myProducts.length})
        </button>
        <button
          onClick={() => setActiveTab("sales")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "sales" 
              ? "bg-secondary text-white shadow-lg" 
              : "text-gray-400 hover:text-white"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Sales & Escrow Orders ({mySales.length})
        </button>
      </div>

      {/* Dashboard View */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-10 h-10 text-secondary animate-spin" />
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-400 bg-red-500/10 border border-red-500/20 rounded-3xl">
          {error}
        </div>
      ) : activeTab === "listings" ? (
        /* Listings Manager Grid */
        myProducts.length === 0 ? (
          <div className="p-16 text-center text-gray-500 border border-dashed border-white/10 rounded-3xl bg-card/30">
            <Store className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-bold text-white mb-1">Your catalog is empty</h3>
            <p className="text-xs">Click 'Create New Listing' to list your first item for sale.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {myProducts.map(product => (
              <div
                key={product.id}
                className="group p-6 rounded-3xl bg-card border border-white/5 flex flex-col justify-between shadow-xl relative"
              >
                <div>
                  <div className="flex justify-between items-start gap-4 mb-4">
                    {/* Status & Category Badge */}
                    <div className="flex flex-col gap-1.5">
                      <span className={`px-2.5 py-1 rounded-full border text-[9px] uppercase font-bold tracking-wider ${getStatusColor(product.status)}`}>
                        {product.status.replace(/_/g, " ")}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-white/5 text-[8px] uppercase font-extrabold text-secondary w-fit tracking-wider">
                        {product.category?.replace(/_/g, " ") || "other"}
                      </span>
                    </div>
                    {/* Type indicator */}
                    <span className="text-[10px] text-gray-500 font-mono">
                      {product.product_type}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white tracking-tight line-clamp-1">{product.title}</h3>
                  <p className="text-gray-400 text-xs mt-2 line-clamp-3 leading-relaxed">{product.description}</p>
                  
                  {/* AI Feedback Box */}
                  {product.review_feedback && (
                    <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/5 text-[10px] text-gray-400 space-y-1">
                      <span className="font-bold text-gray-500 uppercase tracking-wider block">Review Comments</span>
                      <p className="italic leading-relaxed">"{product.review_feedback}"</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                  <div>
                    <span className="text-[9px] text-gray-500 uppercase block font-bold tracking-widest">Price</span>
                    <span className="text-lg font-black text-white">GHS {formatPrice(product.price)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 uppercase block font-bold tracking-widest text-right">Stock</span>
                    <span className="text-sm font-bold text-gray-300 block text-right">{product.stock} units</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Sales Order Manager List */
        mySales.length === 0 ? (
          <div className="p-16 text-center text-gray-500 border border-dashed border-white/10 rounded-3xl bg-card/30">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-bold text-white mb-1">No incoming sales</h3>
            <p className="text-xs">Once someone purchases your items, order details will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mySales.map(order => (
              <div
                key={order.id}
                className="p-6 rounded-3xl bg-card border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[10px] text-gray-500 font-mono font-bold">Order ID: #{order.id.slice(0, 8)}</span>
                    <span className={`px-2.5 py-0.5 rounded-full border text-[9px] uppercase font-bold tracking-wider ${getStatusColor(order.shipping_status)}`}>
                      {order.shipping_status}
                    </span>
                  </div>
                  
                  <div className="text-sm">
                    <span className="text-white font-bold">Buyer RID: </span>
                    <span className="font-mono text-gray-300">{order.buyer_rid}</span>
                  </div>

                  {order.shipping_address && (
                    <div className="text-xs text-gray-400 bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="font-bold text-gray-500 block uppercase text-[9px] tracking-wider mb-1">Delivery Address</span>
                      {order.shipping_address}
                    </div>
                  )}

                  {order.tracking_code && (
                    <div className="text-xs text-primary flex items-center gap-1.5">
                      <Truck className="w-4 h-4" />
                      <span>Tracking details: <strong className="font-mono text-white bg-white/5 px-2 py-0.5 rounded">{order.tracking_code}</strong></span>
                    </div>
                  )}
                </div>

                <div className="flex md:flex-col justify-between items-end gap-2 w-full md:w-auto shrink-0 pt-4 md:pt-0 border-t md:border-t-0 border-white/5">
                  <div className="text-left md:text-right">
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-bold">Sales Income</span>
                    <span className="text-xl font-black text-white">GHS {formatPrice(order.total_price)}</span>
                    <span className="text-[9px] text-gray-400 block mt-0.5">Quantity: {order.quantity}</span>
                  </div>

                  {order.shipping_status === "ESCROWED" && (
                    <button
                      onClick={() => { setSelectedOrder(order); setTrackingCode(""); setShipError(null); }}
                      className="px-4 py-2.5 bg-secondary text-white font-bold rounded-xl text-xs hover:scale-102 transition-all flex items-center gap-1.5 cursor-pointer mt-2"
                    >
                      <Truck className="w-4 h-4" />
                      Mark Shipped
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div 
            onClick={() => setShowAddModal(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative"
            >
              <form onSubmit={handleAddProduct} className="space-y-6">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-secondary tracking-widest block mb-1">Create Listing</span>
                    <h2 className="text-2xl font-black text-white tracking-tight">Upload Product details</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="p-2.5 rounded-xl bg-slate-900 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Item Title *</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. MacBook Pro M1 2021"
                      className="w-full bg-background border border-white/10 rounded-xl p-3 focus:outline-none focus:border-secondary/50 text-white text-xs"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description (Min 10 characters) *</label>
                    <textarea
                      required
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Detail the specifications, condition, contents, or instructions for accessing..."
                      rows={3}
                      className="w-full bg-background border border-white/10 rounded-xl p-3 focus:outline-none focus:border-secondary/50 text-white text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Price */}
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Price (GHS) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        className="w-full bg-background border border-white/10 rounded-xl p-3 focus:outline-none focus:border-secondary/50 text-white text-xs font-mono"
                      />
                    </div>

                    {/* Stock */}
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Initial Stock *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={newStock}
                        onChange={(e) => setNewStock(parseInt(e.target.value))}
                        className="w-full bg-background border border-white/10 rounded-xl p-3 focus:outline-none focus:border-secondary/50 text-white text-xs"
                      />
                    </div>
                  </div>

                  {/* Product Type */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Delivery Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewType("PHYSICAL")}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          newType === "PHYSICAL"
                            ? "bg-secondary/10 border-secondary text-white"
                            : "bg-background border-white/10 text-gray-400 hover:text-white"
                        }`}
                      >
                        <Truck className="w-4 h-4" />
                        Physical Shipment
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewType("DIGITAL")}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          newType === "DIGITAL"
                            ? "bg-secondary/10 border-secondary text-white"
                            : "bg-background border-white/10 text-gray-400 hover:text-white"
                        }`}
                      >
                        <Download className="w-4 h-4" />
                        Digital Delivery
                      </button>
                    </div>
                  </div>

                  {/* Category select */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Product Category *</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full bg-background border border-white/10 rounded-xl p-3 focus:outline-none focus:border-secondary/50 text-white text-xs select-custom cursor-pointer"
                    >
                      <option value="electronics" className="bg-slate-950 text-white">Electronics</option>
                      <option value="books" className="bg-slate-950 text-white">Books</option>
                      <option value="educational" className="bg-slate-950 text-white">Educational</option>
                      <option value="house_ware" className="bg-slate-950 text-white">House Ware</option>
                      <option value="clothing" className="bg-slate-950 text-white">Clothing</option>
                      <option value="other" className="bg-slate-950 text-white">Other</option>
                    </select>
                  </div>
                </div>

                {/* Info Note */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex gap-2.5 text-gray-400 text-[10px] leading-relaxed">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-secondary" />
                  <span>
                    Your item will be immediately reviewed by our AI Moderator after submission. Approved products will go live in the Shopping Mall catalog instantly.
                  </span>
                </div>

                {/* Form Errors */}
                {formError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <p>{formError}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full py-4 bg-secondary text-white font-black rounded-2xl text-sm uppercase tracking-widest hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading Listing...
                    </>
                  ) : (
                    "Submit for AI Review"
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ship Order Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div 
            onClick={() => setSelectedOrder(null)}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative"
            >
              <div className="space-y-6">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-secondary tracking-widest block mb-1">Process Shipment</span>
                    <h2 className="text-2xl font-black text-white tracking-tight">Shipment Tracking</h2>
                    <p className="text-xs text-gray-400 mt-1">Order Ref: #{selectedOrder.id.slice(0, 8)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="p-2.5 rounded-xl bg-slate-900 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Tracking Code / Courier Info *</label>
                  <input
                    type="text"
                    required
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value)}
                    placeholder="e.g. DHL Express: DHL-9082-12"
                    className="w-full bg-background border border-white/10 rounded-xl p-3 focus:outline-none focus:border-secondary/50 text-white text-xs font-mono"
                  />
                  <p className="text-[10px] text-gray-500 leading-normal">
                    Enter the shipment courier name and active tracking number so the buyer can verify shipment.
                  </p>
                </div>

                {shipError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <p>{shipError}</p>
                  </div>
                )}

                <button
                  onClick={handleShipOrder}
                  disabled={shipLoading}
                  className="w-full py-4 bg-secondary text-white font-black rounded-2xl text-sm uppercase tracking-widest hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {shipLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating Shipment...
                    </>
                  ) : (
                    "Mark Order as Shipped"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
