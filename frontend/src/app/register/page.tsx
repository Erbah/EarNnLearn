"use client";

import { useState, useEffect, Suspense, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, Mail, User, KeyRound, Globe, ShoppingCart, ChevronDown, CheckCircle, CreditCard, Smartphone, ShieldCheck, ChevronLeft, Loader2, RefreshCw, Info, Zap, Eye, EyeOff, BookOpen, Coins, Wallet, Video, Sparkles } from "lucide-react";
import axios from "axios";
import { API_BASE_URL, api, setClientToken } from "@/lib/api";

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
    identifier: "",
    password: "",
    manualCode: "",
    // Payment (Pay-in)
    paymentMethod: "paystack",
    paymentProvider: "",
    paymentNumber: "",
    // Payout (Earnings)
    payoutMethod: "paystack",
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
  const [showReferralIntro, setShowReferralIntro] = useState(false);

  const [entryMethod, setEntryMethod] = useState<"rid" | "product_code">("rid");
  const [activationPool, setActivationPool] = useState<any[]>([]);
  const [productPool, setProductPool] = useState<any[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);
  const [codeMetadata, setCodeMetadata] = useState<any>(null);
  const [exchangeRates, setExchangeRates] = useState<any>({});
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isActivationDropdownOpen, setIsActivationDropdownOpen] = useState(false);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // New state variables for validation feedback and loading states
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Ref to prevent double validation
  const lastVerifiedCodeRef = useRef<string>(null || "");
  const isSubmittingRef = useRef<boolean>(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  const loadCurrencies = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.get(`${API}/marketplace/currencies`, { signal });
      const data = res.data;
      setCurrencies(data.currencies);
      setExchangeRates(data.rates);
    } catch (e) {
      if (axios.isCancel(e)) return;
    }
  }, []);

  const loadPools = useCallback(async (signal?: AbortSignal) => {
    setLoadingPool(true);
    try {
      const [ridsRes, productsRes] = await Promise.all([
        api.get(`${API}/marketplace/rids`, { signal }),
        api.get(`${API}/marketplace/product-codes`, { signal })
      ]);
      setActivationPool(ridsRes.data);
      setProductPool(productsRes.data);
    } catch (e) {
      if (axios.isCancel(e)) return;
      console.error("Pool fetch failed:", e);
    } finally {
      if (!signal?.aborted) {
        setLoadingPool(false);
      }
    }
  }, []);

  // Simple input changer
  const handleCodeChange = useCallback((code: string) => {
    setFormData(prev => ({ ...prev, manualCode: code }));
  }, []);

  // Selected code immediately verifies
  const handleSelectCode = useCallback(async (code: string, type: "rid" | "product_code", metadata: any) => {
    setEntryMethod(type);
    setFormData(prev => ({ ...prev, manualCode: code, purchaseAmount: "" }));
    setCodeMetadata(null);
    setIsActivationDropdownOpen(false);
    setIsProductDropdownOpen(false);
    setValidationError(null);
    setIsValidating(true);
    lastVerifiedCodeRef.current = code;

    try {
      const res = await api.get(`${API}/marketplace/check?code=${code}`);
      const meta = res.data;
      if (meta.valid) {
        setCodeMetadata(meta);
        const rate = exchangeRates[formData.preferredCurrency] || 1;
        const converted = meta.price * rate;
        setFormData(prev => ({ ...prev, purchaseAmount: converted.toFixed(2) }));
      } else {
        setValidationError("Selected code is invalid or already used");
      }
    } catch (e) {
      console.error("Verification of selected code failed:", e);
      setValidationError("Failed to verify selected code");
    } finally {
      setIsValidating(false);
    }
  }, [exchangeRates, formData.preferredCurrency]);

  // Unified Parallel Ingestion
  useEffect(() => {
    const controller = new AbortController();
    loadPools(controller.signal);
    loadCurrencies(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadPools, loadCurrencies]);

  // Click outside handling for dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest(".dropdown-container")) {
        setIsActivationDropdownOpen(false);
        setIsProductDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Debounced Validation for Manual Code Inputs
  useEffect(() => {
    setValidationError(null);
    
    // Clear metadata and purchaseAmount immediately on change (unless matched verified ref)
    if (formData.manualCode !== lastVerifiedCodeRef.current) {
      setCodeMetadata(null);
      setFormData(prev => {
        if (prev.purchaseAmount === "") return prev;
        return { ...prev, purchaseAmount: "" };
      });
    }

    if (!formData.manualCode) {
      setIsValidating(false);
      return;
    }

    if (formData.manualCode === lastVerifiedCodeRef.current) {
      return;
    }

    if (formData.manualCode.length < 6) {
      setValidationError("Code must be at least 6 characters");
      return;
    }

    setIsValidating(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const res = await api.get(`${API}/marketplace/check?code=${formData.manualCode}`, {
          signal: controller.signal
        });
        const meta = res.data;
        if (meta.valid) {
          lastVerifiedCodeRef.current = formData.manualCode;
          setCodeMetadata(meta);
          if (meta.type === "rid") {
            setEntryMethod("rid");
          } else if (meta.type === "product_code") {
            setEntryMethod("product_code");
          }
          const converted = meta.price * (exchangeRates[formData.preferredCurrency] || 1);
          setFormData(prev => ({ ...prev, purchaseAmount: converted.toFixed(2) }));
        } else {
          setCodeMetadata(null);
          setValidationError(meta.error || "Code is invalid or not found");
        }
      } catch (e: any) {
        if (!axios.isCancel(e)) {
          console.error("Code check failed:", e);
          setCodeMetadata(null);
          setValidationError("Verification failed. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsValidating(false);
        }
      }
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [formData.manualCode, exchangeRates, formData.preferredCurrency]);

  // Auto-fill from Shareable Link
  useEffect(() => {
    const codeParam = searchParams.get('code');
    const typeParam = (searchParams.get('type') || (codeParam ? "rid" : null)) as "rid" | "product_code";

    if (codeParam && typeParam) {
      setEntryMethod(typeParam);
      setFormData(prev => ({ ...prev, manualCode: codeParam, purchaseAmount: "" }));
      setReferralApplied(true);
      setShowReferralIntro(true);
      lastVerifiedCodeRef.current = codeParam;

      const controller = new AbortController();
      api.get(`${API}/marketplace/check?code=${codeParam}`, { signal: controller.signal })
        .then(res => {
          const meta = res.data;
          if (meta.valid) {
            setCodeMetadata(meta);
          } else {
            setCodeMetadata(null);
            setValidationError(meta.error || "Code is invalid or already used");
            lastVerifiedCodeRef.current = ""; // Reset so manual editing can re-validate
          }
        })
        .catch((err) => {
          if (axios.isCancel(err)) return;
          console.error(err);
          setValidationError("Failed to verify code");
          lastVerifiedCodeRef.current = "";
        });
      return () => {
        controller.abort();
      };
    }
  }, [searchParams]);

  // Auto-calculate required minimum price when metadata or currency changes
  useEffect(() => {
    if (codeMetadata && Object.keys(exchangeRates).length > 0) {
      const rate = exchangeRates[formData.preferredCurrency] || 1;
      const converted = codeMetadata.price * rate;
      
      setFormData(prev => {
        // Only auto-fill if empty. We don't auto-correct lower amounts while typing 
        // so the user can actually see the "Insufficient Amount" warning.
        // If they leave it too low, it's caught by the prompt when they click "Make Payment".
        if (!prev.purchaseAmount) {
          return { ...prev, purchaseAmount: converted.toFixed(2) };
        }
        return prev;
      });
    }
  }, [codeMetadata, exchangeRates, formData.preferredCurrency]);

  // Robust Sync Logic: Keep payout in sync with payment if toggle is on
  useEffect(() => {
    if (formData.paymentMethod === "paystack") {
      setFormData(prev => {
        if (prev.paymentNumber === prev.identifier) return prev;
        return { ...prev, paymentNumber: prev.identifier };
      });
    }
  }, [formData.paymentMethod, formData.identifier]);

  useEffect(() => {
    if (formData.payoutMethod === "paystack") {
      setFormData(prev => {
        if (prev.payoutNumber === prev.identifier) return prev;
        return { ...prev, payoutNumber: prev.identifier };
      });
    }
  }, [formData.payoutMethod, formData.identifier]);

  useEffect(() => {
    setFormData(prev => {
      const newName = `${prev.firstName} ${prev.lastName}`.trim();
      if (prev.payoutName === newName) return prev;
      return { ...prev, payoutName: newName };
    });
  }, [formData.firstName, formData.lastName]);

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

  async function handleRegister() {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setSubmitError(null);
    try {
      const isEmail = formData.identifier.includes('@');
      const email = isEmail ? formData.identifier.trim() : null;
      const phone = isEmail ? null : formData.identifier.trim();

      const registrationData = {
        name: `${formData.firstName} ${formData.lastName}`,
        email: email,
        phone: phone,
        password: formData.password,
        activation_code: formData.manualCode,
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
        setClientToken(token);

        if (data.paystack_url && data.paystack_url !== "#simulated-paystack-checkout") {
          // Real Paystack payment — redirect user to checkout
          window.location.href = data.paystack_url;
          // Keep isSubmittingRef.current = true to prevent subsequent clicks while redirecting
          return;
        } else if (data.user.status === "pending") {
          // Mobile money or simulated — poll for activation
          setIsActivating(true);
          startActivationPolling(token);
        } else {
          // Already active
          router.push("/dashboard");
        }
      }
      isSubmittingRef.current = false;
      setLoading(false);
    } catch (e: any) {
      isSubmittingRef.current = false;
      setLoading(false);
      const data = e.response?.data;
      const errorMessage = data && Array.isArray(data.detail)
        ? data.detail.map((err: any) => `${err.msg} (${err.loc.join('.')})`).join(", ")
        : data?.detail || "Registration failed";
      setSubmitError(errorMessage || "An error occurred during registration");
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
            setClientToken(token);
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
  const isCurrentStepValid = () => {
    if (step === 1) {
      return formData.firstName.trim() !== "" &&
             formData.lastName.trim() !== "" &&
             formData.identifier.trim() !== "" &&
             formData.password.trim() !== "";
    }
    if (step === 2) {
      const codeValid = formData.manualCode.trim() !== "" && codeMetadata !== null;
      const amount = parseFloat(formData.purchaseAmount);
      const amountValid = !isNaN(amount) && amount > 0;
      return codeValid && amountValid;
    }
    return true;
  };

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
        {!showReferralIntro && (
          <div className="flex justify-between mb-8 px-4">
            {!isActivating && [1, 2].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= s ? "bg-primary text-background" : "bg-white/10 text-gray-500 border border-white/10"
                  }`}>
                  {step > s ? <CheckCircle className="w-5 h-5" /> : s}
                </div>
                {s < 2 && <div className={`w-12 sm:w-16 h-[2px] mx-2 ${step > s ? "bg-primary" : "bg-white/10"}`} />}
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
        )}

        {showReferralIntro ? (
          <div className="space-y-6">
            <div className="text-center pb-4 border-b border-white/10">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 border border-primary/20">
                <Sparkles className="w-6 h-6 text-primary animate-pulse" />
              </div>
              <h2 className="text-xl font-bold text-white">You've Been Invited!</h2>
              <p className="text-xs text-gray-400 mt-1">
                Sponsor Code <span className="font-mono text-primary font-bold">{formData.manualCode}</span> has invited you to join the ecosystem.
              </p>
            </div>

            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              <div className="flex gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/20 transition-all duration-200">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Pillar One: Learn</h4>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    Master programming, AI engineering, digital finance, and marketing through structured video lessons. Complete quizzes to unlock cryptographic completion certificates.
                  </p>
                </div>
              </div>

              <div className="flex gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-purple-400/20 transition-all duration-200">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">AI Interactive Tutor</h4>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    Every lesson includes an AI tutor that explains complex code, drafts custom practice quiz questions, and provides personalized study assistance.
                  </p>
                </div>
              </div>

              <div className="flex gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-secondary/20 transition-all duration-200">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Pillar Two: Earn & Payouts</h4>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    Earn up to 70% direct commission when reselling portal access codes to new students. Build network wealth with up to 20% passive downstream network splits.
                  </p>
                </div>
              </div>

              <div className="flex gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-emerald-400/20 transition-all duration-200">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Learn with Your Earnings</h4>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    Accumulate referral commissions in your platform wallet, and use your earnings balance to pay for courses and certificates—no external topups required.
                  </p>
                </div>
              </div>

              <div className="flex gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-400/20 transition-all duration-200">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Video className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Pillar Three: Creator Hub</h4>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    Become a creator! Easily build course syllabi, import YouTube playlists, track student metrics, and receive instant payouts from students.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowReferralIntro(false)}
                className="w-full py-4 bg-primary text-background font-bold rounded-2xl hover:bg-primary/95 transition-all shadow-[0_0_20px_rgba(0,224,255,0.3)] hover:scale-[1.01] flex items-center justify-center gap-2 group"
              >
                Continue to Registration
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ) : isActivating ? (
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
          <form className="space-y-5" onSubmit={(e) => {
            e.preventDefault();
            if (isCurrentStepValid()) {
              if (step === 2) {
                const amount = parseFloat(formData.purchaseAmount);
                const minAmount = codeMetadata ? codeMetadata.price * (exchangeRates[formData.preferredCurrency] || 1) : 0;
                if (amount < minAmount) {
                  const confirmAdjust = window.confirm(`The minimum activation price is ${formData.preferredCurrency} ${minAmount.toFixed(2)}.\n\nYour entered amount of ${formData.preferredCurrency} ${amount.toFixed(2)} is lower than the minimum selling price.\n\nDo you agree to automatically adjust your payment to ${formData.preferredCurrency} ${minAmount.toFixed(2)} to proceed?`);
                  if (confirmAdjust) {
                    setFormData({ ...formData, purchaseAmount: minAmount.toFixed(2) });
                    handleRegister();
                  }
                  return;
                }
                handleRegister();
              } else {
                setStep(step + 1);
              }
            }
          }}>
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
                    <p className="text-sm text-gray-400">Provide at least one contact method (phone number or email address).</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-300 mb-2">First Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                        <input
                          id="firstName"
                          name="firstName"
                          autoComplete="given-name"
                          type="text"
                          aria-label="First Name"
                          value={formData.firstName}
                          onChange={(e) => { setFormData({ ...formData, firstName: e.target.value }); setSubmitError(null); }}
                          className="w-full bg-background/50 border border-white/10 rounded-xl py-3 pl-12 caret-primary focus:outline-none focus:border-primary/50 text-white"
                          placeholder="John"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-300 mb-2">Last Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                        <input
                          id="lastName"
                          name="lastName"
                          autoComplete="family-name"
                          type="text"
                          aria-label="Last Name"
                          value={formData.lastName}
                          onChange={(e) => { setFormData({ ...formData, lastName: e.target.value }); setSubmitError(null); }}
                          className="w-full bg-background/50 border border-white/10 rounded-xl py-3 pl-12 caret-primary focus:outline-none focus:border-primary/50 text-white"
                          placeholder="Doe"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="identifier" className="block text-sm font-medium text-gray-300 mb-2">Email Address or Phone Number <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                      <input
                        id="identifier"
                        name="username"
                        autoComplete="username"
                        type="text"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck="false"
                        aria-label="Email or Phone Number"
                        value={formData.identifier}
                        onChange={(e) => { setFormData({ ...formData, identifier: e.target.value }); setSubmitError(null); }}
                        className="w-full bg-background/50 border border-white/10 rounded-xl py-3 pl-12 caret-primary focus:outline-none focus:border-primary/50 text-white"
                        placeholder="john@example.com or 054 123 4567"
                        required
                      />
                    </div>
                  </div>


                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                      <input
                        id="password"
                        name="password"
                        autoComplete="new-password"
                        type={showPassword ? "text" : "password"}
                        aria-label="Password"
                        value={formData.password}
                        onChange={(e) => { setFormData({ ...formData, password: e.target.value }); setSubmitError(null); }}
                        className="w-full bg-background/50 border border-white/10 rounded-xl py-3 pl-12 pr-12 caret-primary focus:outline-none focus:border-primary/50 text-white"
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

                  <div className="grid grid-cols-2 gap-3 mb-6 relative">
                    <div className="relative dropdown-container">
                      <button
                        type="button"
                        onClick={() => {
                          setEntryMethod("rid");
                          setIsActivationDropdownOpen(!isActivationDropdownOpen);
                          setIsProductDropdownOpen(false);
                        }}
                        className={`w-full flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${(entryMethod === "rid" || isActivationDropdownOpen) ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(34,211,238,0.1)]" : "bg-white/5 border-white/10 hover:border-white/20"
                          }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <KeyRound className={`w-5 h-5 ${(entryMethod === "rid" || isActivationDropdownOpen) ? "text-primary" : "text-gray-500"}`} />
                          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-white">ACTIVATION KEY</span>
                      </button>

                      <AnimatePresence>
                        {isActivationDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute left-0 w-full mt-2 bg-card border border-white/10 rounded-xl overflow-hidden shadow-2xl z-[70] backdrop-blur-xl"
                          >
                            <div className="max-h-[200px] overflow-y-auto">
                              {loadingPool && (
                                <div className="p-3 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                                  Loading codes...
                                </div>
                              )}
                              {!loadingPool && activationPool.length === 0 && (
                                <div className="p-3 text-center text-xs text-gray-500">No activation codes available</div>
                              )}
                              {activationPool.map((c) => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => {
                                    handleSelectCode(c.code, "rid", c);
                                  }}
                                  className="w-full px-4 py-2.5 text-left hover:bg-primary/10 text-white text-xs transition-colors border-b border-white/5 font-mono"
                                >
                                  {c.code}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="relative dropdown-container">
                      <button
                        type="button"
                        onClick={() => {
                          setEntryMethod("product_code");
                          setIsProductDropdownOpen(!isProductDropdownOpen);
                          setIsActivationDropdownOpen(false);
                        }}
                        className={`w-full flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${(entryMethod === "product_code" || isProductDropdownOpen) ? "bg-secondary/10 border-secondary shadow-[0_0_15px_rgba(59,130,246,0.1)]" : "bg-white/5 border-white/10 hover:border-white/20"
                          }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Globe className={`w-5 h-5 ${(entryMethod === "product_code" || isProductDropdownOpen) ? "text-secondary" : "text-gray-500"}`} />
                          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-white">ACCESS KEY (PRODUCT CODE)</span>
                      </button>

                      <AnimatePresence>
                        {isProductDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute right-0 w-full mt-2 bg-card border border-white/10 rounded-xl overflow-hidden shadow-2xl z-[70] backdrop-blur-xl"
                          >
                            <div className="max-h-[200px] overflow-y-auto">
                              {loadingPool && (
                                <div className="p-3 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                                  <Loader2 className="w-3.5 h-3.5 text-secondary animate-spin" />
                                  Loading codes...
                                </div>
                              )}
                              {!loadingPool && productPool.length === 0 && (
                                <div className="p-3 text-center text-xs text-gray-500">No product codes available</div>
                              )}
                              {productPool.map((c) => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => {
                                    handleSelectCode(c.code, "product_code", c);
                                  }}
                                  className="w-full px-4 py-2.5 text-left hover:bg-secondary/10 text-white text-xs transition-colors border-b border-white/5 font-mono"
                                >
                                  {c.code}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <KeyRound className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${entryMethod === "rid" ? "text-primary" : "text-secondary"}`} />
                      <input
                        type="text"
                        aria-label="Access Code"
                        value={formData.manualCode}
                        onChange={(e) => handleCodeChange(e.target.value)}
                        placeholder="Enter or select a code..."
                        className="w-full bg-background/50 border border-white/10 rounded-xl py-3 pl-12 pr-10 text-white caret-primary focus:outline-none focus:border-primary/50 text-sm font-mono placeholder:font-sans"
                      />
                      {isValidating && (
                        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />
                      )}
                    </div>

                    {validationError && (
                      <p className="text-[10px] text-red-400 font-medium pl-1 animate-in fade-in slide-in-from-top-1">
                        {validationError}
                      </p>
                    )}

                    {codeMetadata && (
                      <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5 pl-1 animate-in fade-in slide-in-from-top-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        <span>
                          Code type: {codeMetadata.type === "rid" ? "Activation RID" : "Access Key (Product)"} | Price: {codeMetadata.price} {codeMetadata.currency || "GHS"}
                        </span>
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

                          <div className="space-y-4 pt-2">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Payment Method</label>
                            <div className="grid grid-cols-3 gap-1 bg-background/80 rounded-xl p-1 border border-white/5">
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, paymentMethod: "paystack" })}
                                className={`py-2 rounded-lg text-[10px] font-bold transition-all ${formData.paymentMethod === "paystack" ? "bg-primary text-background shadow-lg" : "text-gray-500 hover:text-white"}`}
                              >
                                PAYSTACK
                              </button>
                              <button
                                type="button"
                                disabled
                                className="py-2 rounded-lg text-[10px] font-bold transition-all text-gray-600 opacity-50 cursor-not-allowed flex flex-col items-center justify-center gap-0.5"
                              >
                                <span>STRIPE</span>
                                <span className="text-[7px] text-primary/70 uppercase">Coming Soon</span>
                              </button>
                              <button
                                type="button"
                                disabled
                                className="py-2 rounded-lg text-[10px] font-bold transition-all text-gray-600 opacity-50 cursor-not-allowed flex flex-col items-center justify-center gap-0.5"
                              >
                                <span>PAYPAL</span>
                                <span className="text-[7px] text-primary/70 uppercase">Coming Soon</span>
                              </button>
                            </div>

                            {formData.paymentMethod === "paystack" && (
                              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                                  <p className="text-[9px] text-gray-400 leading-relaxed uppercase font-bold">Paystack Secure Checkout</p>
                                  <p className="text-[8px] text-gray-500 mb-1.5">Supports Card, MoMo, & Bank Transfer globally.</p>
                                  <p className="text-[8px] text-primary/70 font-mono">Receipt email: {formData.identifier || "Enter email above"}</p>
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

            </AnimatePresence>

            {submitError && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-center mb-4 flex flex-col items-center justify-center ${
                  submitError.toLowerCase().includes('email') ? 'cursor-pointer hover:bg-red-500/20 transition-colors group' : ''
                }`}
                onClick={() => {
                  if (submitError.toLowerCase().includes('email')) {
                    setStep(1);
                  }
                }}
              >
                <p className="text-xs text-red-400 font-bold">{submitError}</p>
                {submitError.toLowerCase().includes('email') && step !== 1 && (
                  <span className="text-[10px] text-red-400/80 mt-1 flex items-center gap-1 group-hover:text-red-300 transition-colors">
                    <ChevronLeft className="w-3 h-3" /> Click here to go back and fix it
                  </span>
                )}
                {submitError.toLowerCase().includes('email') && step === 1 && (
                  <span className="text-[10px] text-red-400/80 mt-1 flex items-center gap-1">
                    Please update your email address above.
                  </span>
                )}
              </motion.div>
            )}

            <div className="flex gap-4 pt-4 mt-8">
              {step > 1 && (
                <button
                  type="button"
                  aria-label="Go Back"
                  onClick={() => {
                    setStep(step - 1);
                    setSubmitError(null);
                  }}
                  className="flex-[0.25] py-4 border border-white/10 rounded-xl hover:bg-white/5 transition-all flex items-center justify-center text-gray-400 group"
                >
                  <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                </button>
              )}

              <button
                type="button"
                aria-label={step === 2 ? "Make Payment" : "Next Phase"}
                onClick={() => {
                  if (step === 2) {
                    const amount = parseFloat(formData.purchaseAmount);
                    const minAmount = codeMetadata ? codeMetadata.price * (exchangeRates[formData.preferredCurrency] || 1) : 0;
                    if (amount < minAmount) {
                      const confirmAdjust = window.confirm(`The minimum activation price is ${formData.preferredCurrency} ${minAmount.toFixed(2)}.\n\nYour entered amount of ${formData.preferredCurrency} ${amount.toFixed(2)} is lower than the minimum selling price.\n\nDo you agree to automatically adjust your payment to ${formData.preferredCurrency} ${minAmount.toFixed(2)} to proceed?`);
                      if (confirmAdjust) {
                        setFormData({ ...formData, purchaseAmount: minAmount.toFixed(2) });
                        handleRegister();
                      }
                      return;
                    }
                    handleRegister();
                  } else {
                    setStep(step + 1);
                  }
                }}
                disabled={loading || !isCurrentStepValid()}
                className={`flex-1 py-4 bg-white text-background font-black text-xs uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center group disabled:opacity-50`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : step === 2 ? "Make Payment" : "Next Phase"}
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
