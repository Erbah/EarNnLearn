"use client";

import { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, Mail, User, KeyRound, Globe, ShoppingCart, ChevronDown, CheckCircle, CreditCard, Smartphone, ShieldCheck, ChevronLeft, Loader2, RefreshCw, Info, Zap, Eye, EyeOff } from "lucide-react";
import { API_BASE_URL, api } from "@/lib/api";

const API = "/api/v1";

// Helper to mask sensitive identifiers (e.g. 055****345 or fr***@email.com)
function maskIdentifier(id: string) {
  if (!id) return "";
  if (id.includes("@")) {
    const [user, domain] = id.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  }
  if (id.length > 6) {
    return `${id.slice(0, 3)}****${id.slice(-3)}`;
  }
  return id;
}

function RegisterForm() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    manualCode: "",
    // Payment (Pay-in)
    paymentMethod: "mobile_money",
    paymentProvider: "MTN",
    paymentNumber: "",
    // Payout (Earnings)
    payoutMethod: "mobile_money",
    payoutProvider: "MTN",
    payoutNumber: "",
    payoutName: "",
    syncPayout: true,
    // Other
    preferredCurrency: "GHS",
    purchaseAmount: ""
  });
  const [isActivating, setIsActivating] = useState(false);
  const [activationStatus, setActivationStatus] = useState("Preparing your account...");
  const [referralApplied, setReferralApplied] = useState(false);

  const [entryMethod, setEntryMethod] = useState<"rid" | "product_code">("rid");
  const [pool, setPool] = useState<any[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");
  const [codeMetadata, setCodeMetadata] = useState<any>(null);
  const [exchangeRates, setExchangeRates] = useState<any>({});
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    loadPool(entryMethod);
    loadCurrencies();
  }, [entryMethod]);

  // Auto-fill from Shareable Link
  useEffect(() => {
    const codeParam = searchParams.get('code');
    const typeParam = (searchParams.get('type') || (codeParam ? "rid" : null)) as "rid" | "product_code";

    if (codeParam && typeParam) {
      setEntryMethod(typeParam);
      setSelectedCode(codeParam);
      setFormData(prev => ({ ...prev, manualCode: codeParam }));
      setReferralApplied(true);

      api.get(`${API}/marketplace/check?code=${codeParam}`)
        .then(res => {
          const meta = res.data;
          if (meta.valid) {
            setCodeMetadata(meta);
          }
        })
        .catch(console.error);
    }
  }, [searchParams]);

  // Auto-calculate required minimum price when metadata or currency changes
  useEffect(() => {
    if (codeMetadata && Object.keys(exchangeRates).length > 0) {
      const rate = exchangeRates[formData.preferredCurrency] || 1;
      const converted = codeMetadata.price * rate;
      // Only set if not already set or if less than minimum (prevents overwriting user inputs unless necessary)
      if (!formData.purchaseAmount || parseFloat(formData.purchaseAmount) < converted) {
        setFormData(prev => ({ ...prev, purchaseAmount: converted.toFixed(2) }));
      }
    }
  }, [codeMetadata, exchangeRates, formData.preferredCurrency]);

  // Robust Sync Logic: Keep payout in sync with payment if toggle is on
  useEffect(() => {
    if (formData.syncPayout) {
      setFormData(prev => ({
        ...prev,
        payoutMethod: prev.paymentMethod,
        payoutProvider: prev.paymentProvider,
        payoutNumber: prev.paymentNumber
      }));
    }
  }, [formData.syncPayout, formData.paymentMethod, formData.paymentProvider, formData.paymentNumber]);

  async function loadCurrencies() {
    try {
      const res = await api.get(`${API}/marketplace/currencies`);
      const data = res.data;
      setCurrencies(data.currencies);
      setExchangeRates(data.rates);
    } catch (e) { }
  }

  async function loadPool(type: "rid" | "product_code") {
    setLoadingPool(true);
    try {
      const endpoint = type === "rid" ? "rids" : "product-codes";
      const url = `${API}/marketplace/${endpoint}`;
      console.log("Fetching pool from:", url);
      const res = await api.get(url);
      console.log("Pool data received:", res.data);
      setPool(res.data);
    } catch (e) {
      console.error("Pool fetch failed:", e);
    } finally {
      setLoadingPool(false);
    }
  }

  async function handleRegister() {
    setLoading(true);
    try {
      const registrationData = {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        phone: formData.payoutNumber || formData.phone,
        password: formData.password,
        activation_code: selectedCode === "manual" ? formData.manualCode : selectedCode,
        code_type: entryMethod,
        purchase_amount: parseFloat(formData.purchaseAmount),
        preferred_currency: formData.preferredCurrency,
        payment_method: formData.paymentMethod,
        payment_number: formData.paymentNumber,
        payment_provider: formData.paymentProvider,
        payout_method: formData.payoutMethod,
        payout_number: formData.payoutNumber,
        payout_provider: formData.payoutProvider,
        payout_name: formData.payoutName,
      };

      const res = await api.post(`${API}/auth/register`, registrationData);

      if (res.status === 200 || res.status === 201) {
        const data = res.data;
        const token = data.token.access_token;
        localStorage.setItem("access_token", token);

        if (data.user.status === "pending") {
          setIsActivating(true);
          startActivationPolling(token);
        } else {
          // Account already active, redirect immediately
          router.push("/dashboard");
        }
      }
    } catch (e: any) {
      const data = e.response?.data;
      const errorMessage = data && Array.isArray(data.detail)
        ? data.detail.map((err: any) => `${err.msg} (${err.loc.join('.')})`).join(", ")
        : data?.detail || "Registration failed";
      alert(errorMessage || "An error occurred during registration");
    } finally {
      setLoading(false);
    }
  }

  async function startActivationPolling(token: string) {
    setActivationStatus("Waiting for payment verification...");
    let detectedActive = false;
    
    const interval = setInterval(async () => {
      if (detectedActive) return; // Prevent multiple redirects
      try {
        const res = await api.get(`${API}/auth/me`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.status === 200) {
          const user = res.data;
          if (user.status === "active") {
            detectedActive = true;
            clearInterval(interval);
            setActivationStatus("Account activated! Redirecting...");
            localStorage.setItem("access_token", token);
            // Shorter delay - bootstrap will load faster with token cached
            setTimeout(() => router.push("/dashboard"), 800);
          }
        }
      } catch (e: any) {
        if (e.response?.status !== 401) {
          console.error("Polling fetch failed", e.response?.status);
        }
      }
    }, 1500); // Reduced from 3000ms to 1500ms for faster activation detection

    // Cleanup interval after 3 minutes if it doesn't activate
    const timeoutId = setTimeout(() => {
      clearInterval(interval);
      detectedActive = true;
      setActivationStatus("Activation is taking longer than expected. Please refresh or login later to check status.");
    }, 180000);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden py-12 px-4">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-secondary/10 blur-[150px] rounded-full pointer-events-none -z-10" />

      {/* Back to Home */}
      <Link
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-gray-500 hover:text-white transition-colors group z-20"
      >
        <div className="p-2 rounded-xl bg-white/5 border border-white/10 group-hover:border-primary/50 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium">Back to Website</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-card border border-white/10 shadow-2xl glass relative z-10"
      >
        <div className="flex justify-between mb-8 px-4">
          {!isActivating && [1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= s ? "bg-primary text-background" : "bg-white/10 text-gray-500 border border-white/10"
                }`}>
                {step > s ? <CheckCircle className="w-5 h-5" /> : s}
              </div>
              {s < 3 && <div className={`w-12 sm:w-16 h-[2px] mx-2 ${step > s ? "bg-primary" : "bg-white/10"}`} />}
            </div>
          ))}
          {isActivating && (
            <div className="flex items-center justify-center w-full">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center animate-pulse">
                <ShieldCheck className="w-6 h-6 text-background" />
              </div>
            </div>
          )}
        </div>

        {isActivating ? (
          <div className="text-center py-12 space-y-6">
            <div className="relative inline-block">
              <Loader2 className="w-16 h-16 text-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center font-black text-primary text-[10px]">PAY</div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Activating Your Account</h2>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">{activationStatus}</p>
            </div>
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              Ref: SECURE-PAYMENT-ACTIVE
            </div>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {referralApplied && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 backdrop-blur-md"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">Activation Link Applied</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-white/90">Code <span className="font-mono text-emerald-400 font-bold">{formData.manualCode}</span> is ready.</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-white">Identity Setup</h2>
                    <p className="text-sm text-gray-400">Basic details for your permanent account.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">First Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                          type="text"
                          aria-label="First Name"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          className="w-full bg-background/50 border border-white/10 rounded-xl py-3 pl-12 focus:outline-none focus:border-primary/50 text-white"
                          placeholder="John"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Last Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                          type="text"
                          aria-label="Last Name"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          className="w-full bg-background/50 border border-white/10 rounded-xl py-3 pl-12 focus:outline-none focus:border-primary/50 text-white"
                          placeholder="Doe"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="email"
                        aria-label="Email Address"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-background/50 border border-white/10 rounded-xl py-3 pl-12 focus:outline-none focus:border-primary/50 text-white"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>


                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        aria-label="Password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full bg-background/50 border border-white/10 rounded-xl py-3 pl-12 pr-12 focus:outline-none focus:border-primary/50 text-white"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-white">Entry Method</h2>
                    <p className="text-sm text-gray-400">Unlock your account with an Activation RID.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                      type="button"
                      onClick={() => { setEntryMethod("rid"); setSelectedCode(""); setCodeMetadata(null); }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${entryMethod === "rid" ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]" : "bg-white/5 border-white/10 hover:border-white/20"
                        }`}
                    >
                      <KeyRound className={`w-5 h-5 ${entryMethod === "rid" ? "text-primary" : "text-gray-500"}`} />
                      <span className="text-[10px] uppercase font-bold tracking-wider text-white">ACTIVATION KEY</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEntryMethod("product_code"); setSelectedCode(""); setCodeMetadata(null); }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${entryMethod === "product_code" ? "bg-secondary/10 border-secondary shadow-[0_0_15px_rgba(var(--secondary-rgb),0.1)]" : "bg-white/5 border-white/10 hover:border-white/20"
                        }`}
                    >
                      <Globe className={`w-5 h-5 ${entryMethod === "product_code" ? "text-secondary" : "text-gray-500"}`} />
                      <span className="text-[10px] uppercase font-bold tracking-wider text-white">ACCESS KEY (PRODUCT CODE)</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="relative z-[60]">
                      <button
                        type="button"
                        aria-label="Select activation code"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-center focus:outline-none relative"
                      >
                        <span className="truncate block w-full px-4">
                          {selectedCode === "manual" ? "Enter manually..." :
                            selectedCode ? (
                              selectedCode
                            ) : "Select a code..."
                          }
                        </span>
                        <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {isDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute w-full mt-2 bg-card border border-white/10 rounded-xl overflow-hidden shadow-2xl z-[70] backdrop-blur-xl"
                          >
                            <div className="max-h-[200px] overflow-y-auto">
                              <button
                                type="button"
                                onClick={() => { setSelectedCode("manual"); setCodeMetadata(null); setIsDropdownOpen(false); }}
                                className="w-full px-5 py-3 text-left hover:bg-white/5 text-gray-400 text-sm border-b border-white/5"
                              >
                                Enter manually...
                              </button>
                              {pool.map((c) => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCode(c.code);
                                    setCodeMetadata(c);
                                    setIsDropdownOpen(false);
                                    const converted = c.price * (exchangeRates[formData.preferredCurrency] || 1);
                                    setFormData(prev => ({ ...prev, purchaseAmount: converted.toFixed(2) }));
                                  }}
                                  className="w-full px-5 py-3 text-left hover:bg-primary/10 text-white text-sm transition-colors border-b border-white/5"
                                >
                                  {c.code}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {selectedCode === "manual" && (
                      <div className="relative">
                        <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                          type="text"
                          aria-label="Manual Code Input"
                          value={formData.manualCode}
                          onChange={async (e) => {
                            const code = e.target.value;
                            setFormData({ ...formData, manualCode: code });
                            if (code.length >= 6) {
                              try {
                                const res = await api.get(`${API}/marketplace/check?code=${code}`);
                                const meta = res.data;
                                if (meta.valid) {
                                  setCodeMetadata(meta);
                                  const converted = meta.price * (exchangeRates[formData.preferredCurrency] || 1);
                                  setFormData(prev => ({ ...prev, purchaseAmount: converted.toFixed(2) }));
                                }
                              } catch (e) {
                                console.error("Manual code verification failed:", e);
                              }
                            }
                          }}
                          placeholder="Paste your code here..."
                          className="w-full bg-background/50 border border-white/10 rounded-xl py-3 pl-12 text-white focus:outline-none focus:border-primary/50"
                        />
                      </div>
                    )}

                    <AnimatePresence>
                      {codeMetadata && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4 shadow-inner"
                        >
                          <div className="bg-primary/5 p-3 rounded-xl border border-primary/10">
                            <div className="flex justify-between items-center mb-4">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pricing Control</span>
                              <div className="flex items-center gap-2">
                                <Globe className="w-3 h-3 text-primary/70" />
                                <select
                                  aria-label="Preferred Currency"
                                  value={formData.preferredCurrency}
                                  onChange={(e) => {
                                    const newCurr = e.target.value;
                                    const converted = codeMetadata.price * (exchangeRates[newCurr] || 1);
                                    setFormData({ ...formData, preferredCurrency: newCurr, purchaseAmount: converted.toFixed(2) });
                                  }}
                                  className="bg-transparent text-white text-xs font-bold focus:outline-none appearance-none cursor-pointer"
                                >
                                  {currencies.map(c => <option key={c} value={c} className="bg-card text-white">{c}</option>)}
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[9px] text-gray-500 uppercase font-black mb-1">Min. Selling Price</p>
                                <p className="text-white font-mono font-bold">
                                  {(codeMetadata.price * (exchangeRates[formData.preferredCurrency] || 1)).toFixed(2)} <span className="text-[10px] opacity-60">{formData.preferredCurrency}</span>
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] text-primary uppercase font-black mb-1">Your Price</p>
                                <div className="relative">
                                  <input
                                    type="number"
                                    aria-label="Purchase Amount"
                                    value={formData.purchaseAmount}
                                    onChange={(e) => setFormData({ ...formData, purchaseAmount: e.target.value })}
                                    className="w-full bg-background/50 border border-primary/20 rounded-lg py-1 px-2 text-sm text-white focus:outline-none focus:border-primary"
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                            </div>
                            {parseFloat(formData.purchaseAmount) < (codeMetadata.price * (exchangeRates[formData.preferredCurrency] || 1)) && (
                              <p className="text-[9px] text-red-500 font-bold mt-2 uppercase text-center animate-pulse">Insufficient Amount</p>
                            )}
                          </div>

                          {/* Transaction explanation Banner */}
                          <div className="bg-secondary/5 border border-secondary/20 p-3 rounded-xl flex gap-3">
                            <Info className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <h4 className="text-[10px] font-black text-secondary uppercase tracking-tight">Financial Security</h4>
                              <p className="text-[9px] text-gray-400 leading-relaxed">
                                Activation (pay-in) is separate from earnings (pay-out). We use secure gateways like **Paystack** to ensure your data is protected.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Choose Payment Method</label>
                            <div className="grid grid-cols-3 gap-1 bg-background/80 rounded-xl p-1 border border-white/5">
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, paymentMethod: "mobile_money" })}
                                className={`py-2 rounded-lg text-[10px] font-bold transition-all ${formData.paymentMethod === "mobile_money" ? "bg-primary text-background shadow-lg" : "text-gray-500 hover:text-white"}`}
                              >
                                LOCAL
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, paymentMethod: "paystack" })}
                                className={`py-2 rounded-lg text-[10px] font-bold transition-all ${formData.paymentMethod === "paystack" ? "bg-primary text-background shadow-lg" : "text-gray-500 hover:text-white"}`}
                              >
                                PAYSTACK
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, paymentMethod: "stripe" })}
                                className={`py-2 rounded-lg text-[10px] font-bold transition-all ${formData.paymentMethod === "stripe" ? "bg-primary text-background shadow-lg" : "text-gray-500 hover:text-white"}`}
                              >
                                GLOBAL
                              </button>
                            </div>

                            {formData.paymentMethod === "mobile_money" && (
                              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-3 gap-2">
                                  {["MTN", "Vodafone", "AirtelTigo"].map(p => (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() => setFormData({ ...formData, paymentProvider: p })}
                                      className={`py-2 rounded-lg border text-[9px] font-black transition-all ${formData.paymentProvider === p ? "bg-primary/20 border-primary text-white" : "bg-white/5 border-white/10 text-gray-500"}`}
                                    >
                                      {p.toUpperCase()}
                                    </button>
                                  ))}
                                </div>
                                <div className="relative">
                                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                  <input
                                    type="text"
                                    aria-label="Payment Phone Number"
                                    value={formData.paymentNumber}
                                    onChange={(e) => setFormData({ ...formData, paymentNumber: e.target.value })}
                                    placeholder="Confirm payment phone"
                                    className="w-full bg-background/80 border border-white/10 rounded-lg py-3 pl-10 text-xs text-white focus:outline-none focus:border-primary/40"
                                  />
                                </div>
                              </div>
                            )}

                            {formData.paymentMethod === "paystack" && (
                              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                                  <p className="text-[9px] text-gray-400 leading-relaxed uppercase font-bold">Paystack Secure</p>
                                  <p className="text-[8px] text-gray-500">Supports Card, MoMo, & Bank Transfer</p>
                                </div>
                                <div className="relative">
                                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                  <input
                                    type="email"
                                    aria-label="Paystack Transaction Email"
                                    value={formData.paymentNumber}
                                    onChange={(e) => setFormData({ ...formData, paymentNumber: e.target.value })}
                                    placeholder="Transaction receipt email"
                                    className="w-full bg-background/80 border border-white/10 rounded-lg py-3 pl-10 text-xs text-white focus:outline-none focus:border-primary/40"
                                  />
                                </div>
                              </div>
                            )}

                            {formData.paymentMethod === "stripe" && (
                              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="relative">
                                  <ShoppingCart className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                  <input
                                    type="text"
                                    aria-label="Payment Account ID"
                                    value={formData.paymentNumber}
                                    onChange={(e) => setFormData({ ...formData, paymentNumber: e.target.value })}
                                    placeholder="Email/Card Account for payment"
                                    className="w-full bg-background/80 border border-white/10 rounded-lg py-3 pl-10 text-xs text-white focus:outline-none focus:border-primary/40"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-white">Earnings Setup</h2>
                    <p className="text-sm text-gray-400">Where you want to receive your profits.</p>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, syncPayout: !formData.syncPayout })}
                    className="bg-primary/10 border border-primary/20 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-primary/15 transition-all shadow-[0_0_20px_rgba(var(--primary-rgb),0.05)]"
                  >
                    <div className="flex gap-3">
                      <RefreshCw className={`w-5 h-5 text-primary ${formData.syncPayout ? "animate-spin-[duration:10s]" : ""}`} />
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight">Sync Financial Identity</h4>
                        <p className="text-[10px] text-primary/70">Use my payment info for earning rewards.</p>
                      </div>
                    </div>
                    <div className={`w-10 h-6 rounded-full p-1 transition-all ${formData.syncPayout ? "bg-primary" : "bg-white/10"}`}>
                      <div className={`w-4 h-4 bg-white rounded-full transition-all ${formData.syncPayout ? "ml-4" : "ml-0"}`} />
                    </div>
                  </div>

                  {!formData.syncPayout ? (
                    <div className="space-y-5 animate-in slide-in-from-top-4 duration-500">
                      <div className="grid grid-cols-4 gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                        {[
                          { id: "mobile_money", label: "MOMO" },
                          { id: "paystack", label: "PAYSTACK" },
                          { id: "paypal", label: "PAYPAL" },
                          { id: "bank", label: "BANK" }
                        ].map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, payoutMethod: m.id })}
                            className={`py-2 rounded-lg text-[8px] font-black transition-all ${formData.payoutMethod === m.id ? "bg-secondary text-background" : "text-gray-500 hover:text-white"}`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>

                      {formData.payoutMethod === "mobile_money" && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                          <div className="grid grid-cols-3 gap-2">
                            {["MTN", "Vodafone", "AirtelTigo"].map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setFormData({ ...formData, payoutProvider: p })}
                                className={`py-2 rounded-lg border text-[9px] font-black transition-all ${formData.payoutProvider === p ? "bg-secondary/20 border-secondary text-white" : "bg-white/5 border-white/10 text-gray-500"}`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            aria-label="Payout Phone Number"
                            value={formData.payoutNumber}
                            onChange={(e) => setFormData({ ...formData, payoutNumber: e.target.value })}
                            placeholder="Phone Number (024...)"
                            className="w-full bg-background/50 border border-white/10 rounded-xl py-3 px-4 text-xs text-secondary focus:outline-none focus:border-secondary/50 placeholder:text-gray-600 shadow-inner"
                          />
                        </div>
                      )}

                      {formData.payoutMethod === "paystack" && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                          <div className="bg-secondary/10 p-3 rounded-lg border border-secondary/20">
                            <p className="text-[9px] text-secondary/70 uppercase font-black">Paystack Transfer</p>
                            <p className="text-[8px] text-gray-500 leading-tight">Fast settlements directly to your bank or wallet.</p>
                          </div>
                          <input
                            type="email"
                            aria-label="Paystack Registration Email"
                            value={formData.payoutNumber}
                            onChange={(e) => setFormData({ ...formData, payoutNumber: e.target.value })}
                            placeholder="Registered Paystack Email"
                            className="w-full bg-background/50 border border-white/10 rounded-xl py-3 px-4 text-xs text-secondary focus:outline-none focus:border-secondary/50 placeholder:text-gray-600 shadow-inner"
                          />
                        </div>
                      )}

                      {(formData.payoutMethod === "paypal" || formData.payoutMethod === "bank") && (
                        <div className="space-y-3 animate-in fade-in duration-300">
                          <input
                            type="text"
                            aria-label="Payout Account ID"
                            value={formData.payoutNumber}
                            onChange={(e) => setFormData({ ...formData, payoutNumber: e.target.value })}
                            placeholder={formData.payoutMethod === "paypal" ? "PayPal Email" : "Bank Account Number"}
                            className="w-full bg-background/50 border border-white/10 rounded-xl py-3 px-4 text-xs text-secondary focus:outline-none focus:border-secondary/50 placeholder:text-gray-600 shadow-inner"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2 opacity-80 backdrop-blur-sm shadow-inner">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Financial Summary</p>
                        <Zap className="w-3 h-3 text-primary animate-pulse" />
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-white text-sm font-mono flex items-center gap-2">
                          {formData.paymentMethod === "mobile_money" ? <Smartphone className="w-4 h-4 text-primary" /> : <ShieldCheck className="w-4 h-4 text-primary" />}
                          {maskIdentifier(formData.paymentNumber) || <span className="text-gray-600 text-[10px] italic">No details entered</span>}
                        </p>
                        <span className="text-[9px] font-black text-primary/80 bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 uppercase">
                          {formData.paymentMethod === "paystack" ? "Paystack" : (formData.paymentProvider || "Global")}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      aria-label="Account Holder Name"
                      value={formData.payoutName}
                      onChange={(e) => setFormData({ ...formData, payoutName: e.target.value })}
                      placeholder="Registered Legal Name"
                      className="w-full bg-background/50 border border-white/10 rounded-xl py-3 pl-12 text-xs text-white focus:outline-none focus:border-primary/40 shadow-inner"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-4 pt-4 mt-8">
              {step > 1 && (
                <button
                  type="button"
                  aria-label="Go Back"
                  onClick={() => setStep(step - 1)}
                  className="flex-[0.25] py-4 border border-white/10 rounded-xl hover:bg-white/5 transition-all flex items-center justify-center text-gray-400 group"
                >
                  <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                </button>
              )}

              <button
                type="button"
                aria-label={step === 3 ? "Launch Account" : "Next Phase"}
                onClick={() => step < 3 ? setStep(step + 1) : handleRegister()}
                disabled={loading || (step === 2 && codeMetadata && (parseFloat(formData.purchaseAmount) < (codeMetadata.price * (exchangeRates[formData.preferredCurrency] || 1))))}
                className={`flex-1 py-4 bg-white text-background font-black text-xs uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center group disabled:opacity-50`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : step === 3 ? "Launch Account" : "Next Phase"}
                {!loading && <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />}
              </button>
            </div>
          </form>
        )}

        <p className="text-xs text-center text-gray-500 mt-6 font-medium">
          Joined the network? <Link href="/login" className="text-white hover:text-primary transition-colors">Sign in here</Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
