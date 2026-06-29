"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShoppingBag, 
  Search, 
  Tag, 
  Wallet, 
  X, 
  Truck, 
  Download, 
  ShieldCheck, 
  Loader2, 
  AlertTriangle,
  ChevronRight,
  Sparkles
} from "lucide-react";
import axios from "axios";
import { api } from "@/lib/api";

const API = "/api/v1";

interface Product {
  id: string;
  seller_rid: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  stock: number;
  image_urls: string[] | null;
  product_type: "PHYSICAL" | "DIGITAL";
  category: string;
  status: string;
}

interface WalletData {
  balance: number;
  currency: string;
}

const formatPrice = (val: any) => {
  const num = Number(val);
  return isNaN(num) ? "0.00" : num.toFixed(2);
};

const CATEGORIES = [
  { id: "ALL", label: "All Categories" },
  { id: "electronics", label: "Electronics" },
  { id: "books", label: "Books" },
  { id: "educational", label: "Educational" },
  { id: "house_ware", label: "House Ware" },
  { id: "clothing", label: "Clothing" },
  { id: "other", label: "Other" }
];

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"ALL" | "PHYSICAL" | "DIGITAL">("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Buy Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [shippingAddress, setShippingAddress] = useState("");
  const [buyLoading, setBuyLoading] = useState(false);
  const [buySuccess, setBuySuccess] = useState(false);
  const idempotencyKeyRef = useRef<string>('');
  const [buyError, setBuyError] = useState<string | null>(null);

  const fetchShopData = useCallback(async (cat?: string, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const categoryParam = cat && cat !== "ALL" ? `?category=${cat}` : "";
      const [pRes, wRes] = await Promise.all([
        api.get(`${API}/shop/products${categoryParam}`, { signal }),
        api.get(`${API}/wallet/`, { signal })
      ]);
      setProducts(pRes.data);
      setWallet(wRes.data);
    } catch (err) {
      if (axios.isCancel(err)) return;
      console.error(err);
      setError("Failed to load shopping mall. Please try again later.");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchShopData(selectedCategory, controller.signal);
    return () => controller.abort();
  }, [fetchShopData, selectedCategory]);

  const handleOpenBuyModal = (product: Product) => {
    setSelectedProduct(product);
    setQuantity(1);
    setShippingAddress("");
    setBuySuccess(false);
    setBuyError(null);
    idempotencyKeyRef.current = crypto.randomUUID();
  };

  const handlePurchase = async () => {
    if (!selectedProduct) return;
    if (selectedProduct.product_type === "PHYSICAL" && !shippingAddress.trim()) {
      setBuyError("Please provide a shipping address for physical delivery.");
      return;
    }

    setBuyLoading(true);
    setBuyError(null);
    try {
      await api.post(`${API}/shop/buy`, {
        product_id: selectedProduct.id,
        quantity: quantity,
        shipping_address: selectedProduct.product_type === "PHYSICAL" ? shippingAddress : null
      }, { headers: { "Idempotency-Key": idempotencyKeyRef.current } });

      setBuySuccess(true);
      // Refresh shop data
      fetchShopData(selectedCategory);
    } catch (err: any) {
      console.error(err);
      setBuyError(err.response?.data?.detail || "Purchase failed. Please check your balance.");
      idempotencyKeyRef.current = crypto.randomUUID();
    } finally {
      setBuyLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "ALL" || p.product_type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border border-white/5 p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-primary/10 rounded-full blur-[80px] -z-10" />
        
        <div>
          <div className="flex items-center gap-2 text-primary text-xs uppercase font-extrabold tracking-widest mb-1.5">
            <Sparkles className="w-4 h-4 animate-pulse" />
            EarNnLearn Marketplace
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-2">Ecosystem Shopping Mall</h1>
          <p className="text-gray-400 text-sm max-w-md">
            Purchase physical tech gear or digital learning assets directly using your platform wallet balance.
          </p>
        </div>

        {/* Wallet Balance Card */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 shrink-0">
          <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Wallet Balance</span>
            <span className="text-xl font-black text-white">
              {wallet ? `${wallet.currency} ${formatPrice(wallet.balance)}` : "Loading..."}
            </span>
          </div>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-white/5">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              selectedCategory === cat.id
                ? "bg-primary text-background border-primary shadow-lg shadow-primary/15 scale-105"
                : "bg-card text-gray-400 border-white/5 hover:text-white hover:border-white/10"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-white/5 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:border-primary/50 text-white text-sm transition-all"
          />
        </div>

        {/* Toggle Types */}
        <div className="flex gap-1 bg-slate-900/60 p-1.5 rounded-2xl border border-white/10 w-fit">
          {(["ALL", "PHYSICAL", "DIGITAL"] as const).map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedType === type 
                  ? "bg-primary text-background shadow-lg" 
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-400 bg-red-500/10 border border-red-500/20 rounded-3xl">
          {error}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-16 text-center text-gray-500 border border-dashed border-white/10 rounded-3xl bg-card/30">
          <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-bold text-white mb-1">No items found</h3>
          <p className="text-xs">Try adjusting your search criteria or check back later.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(product => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="group p-6 rounded-3xl bg-card border border-white/5 hover:border-primary/20 transition-all flex flex-col justify-between shadow-xl relative overflow-hidden"
            >
              <div>
                {/* Type Badge */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 border border-white/10 backdrop-blur-md text-[10px] font-bold text-gray-300 z-10">
                  {product.product_type === "PHYSICAL" ? (
                    <>
                      <Truck className="w-3.5 h-3.5 text-primary" />
                      Physical
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-purple-400" />
                      Digital
                    </>
                  )}
                </div>

                {/* Category Badge */}
                <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-slate-950/80 border border-white/10 backdrop-blur-md text-[10px] font-extrabold text-primary uppercase tracking-wider z-10">
                  {product.category?.replace('_', ' ') || 'other'}
                </div>

                {/* Cover Icon placeholder */}
                <div className="w-full h-40 bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-white/5 flex items-center justify-center mb-5 group-hover:border-primary/10 transition-colors relative">
                  {product.product_type === "PHYSICAL" ? (
                    <ShoppingBag className="w-12 h-12 text-primary/30 group-hover:scale-105 transition-transform" />
                  ) : (
                    <Tag className="w-12 h-12 text-purple-500/30 group-hover:scale-105 transition-transform" />
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors line-clamp-1">{product.title}</h3>
                  <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed">{product.description}</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest block font-bold">Price</span>
                  <span className="text-lg font-black text-white">GHS {formatPrice(product.price)}</span>
                </div>
                
                <button
                  onClick={() => handleOpenBuyModal(product)}
                  className="px-4 py-2.5 rounded-xl bg-primary text-background font-bold text-xs hover:scale-105 transition-all flex items-center gap-1 cursor-pointer"
                >
                  Buy Now
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Checkout Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative"
            >
              {/* Close */}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-6 right-6 p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {!buySuccess ? (
                <div className="space-y-6">
                  {/* Header */}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-primary tracking-widest block mb-1">Ecosystem Escrow Checkout</span>
                    <h2 className="text-2xl font-black text-white tracking-tight line-clamp-1">{selectedProduct.title}</h2>
                    <p className="text-gray-400 text-xs mt-1">Sold by partner <span className="font-mono text-white">{selectedProduct.seller_rid}</span></p>
                  </div>

                  {/* Pricing Info */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">Unit Price:</span>
                      <span className="text-white font-bold">GHS {formatPrice(selectedProduct.price)}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">Quantity:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setQuantity(q => Math.max(1, q - 1))}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white cursor-pointer font-bold"
                        >
                          -
                        </button>
                        <span className="text-white font-black font-mono w-4 text-center">{quantity}</span>
                        <button
                          onClick={() => setQuantity(q => Math.min(selectedProduct.stock, q + 1))}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white cursor-pointer font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="h-[1px] bg-white/5 my-2" />

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400 font-bold">Total Bill:</span>
                      <span className="text-xl font-black text-primary">GHS {formatPrice(Number(selectedProduct.price) * quantity)}</span>
                    </div>
                  </div>

                  {/* Physical Delivery Fields */}
                  {selectedProduct.product_type === "PHYSICAL" ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Shipping Address *</label>
                      <textarea
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        placeholder="House Number, Street Name, City, Country, Phone Number..."
                        rows={3}
                        className="w-full bg-background border border-white/10 rounded-xl p-3 focus:outline-none focus:border-primary/50 text-white text-xs"
                      />
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex gap-3 text-purple-400">
                      <Download className="w-5 h-5 shrink-0 mt-0.5" />
                      <div className="text-xs leading-relaxed">
                        <span className="font-bold block">Digital Goods Delivery</span>
                        This is a digital product. It will be auto-delivered instantly, but funds remain locked in escrow for a 48-hour safety window.
                      </div>
                    </div>
                  )}

                  {/* Security Alert */}
                  <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex gap-3 text-emerald-500">
                    <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-[10px] leading-relaxed uppercase tracking-wider font-bold">
                      Protected by EarNnLearn Escrow. Sellers do not receive payouts until delivery is verified.
                    </div>
                  </div>

                  {/* Errors */}
                  {buyError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <p>{buyError}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={handlePurchase}
                    disabled={buyLoading || (wallet ? Number(wallet.balance) < Number(selectedProduct.price) * quantity : true)}
                    className="w-full py-4 bg-primary text-background font-black rounded-2xl text-sm uppercase tracking-widest hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {buyLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing Escrow...
                      </>
                    ) : (
                      "Confirm & Pay"
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center py-6 space-y-6">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                    <ShieldCheck className="w-10 h-10 text-emerald-500 animate-pulse" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white">Purchase Successful!</h3>
                    <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                      Your payment of GHS {formatPrice(Number(selectedProduct.price) * quantity)} has been charged and is held securely in escrow.
                    </p>
                  </div>

                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-left space-y-2 text-xs text-gray-400">
                    <p>• Sellers have been notified to process shipping.</p>
                    {selectedProduct.product_type === "PHYSICAL" ? (
                      <p>• Once received, confirm the delivery in your Dashboard to release payouts.</p>
                    ) : (
                      <p>• Digital credentials/access codes have been sent. Escrow auto-releases in 48 hours.</p>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="w-full py-3.5 bg-white text-background font-bold rounded-2xl text-xs uppercase tracking-widest hover:bg-gray-200 transition-all cursor-pointer"
                  >
                    Close Window
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
