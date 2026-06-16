"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User as UserIcon,
  Lock,
  CreditCard,
  BookOpen,
  Save,
  RefreshCcw,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronDown
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import { API_BASE_URL, api } from "@/lib/api";

const API = `${API_BASE_URL}/api/v1`;

type TabType = "profile" | "financial" | "learning" | "security";

export default function SettingsPage() {
  const { user, refetchUser } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  
  // Loading & Feedback states
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Profile fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preferredNotification, setPreferredNotification] = useState("auto");

  // Financial fields
  const [preferredPayment, setPreferredPayment] = useState("mobile_money");
  const [payoutMethod, setPayoutMethod] = useState("mobile_money");
  const [payoutNumber, setPayoutNumber] = useState("");
  const [payoutProvider, setPayoutProvider] = useState("MTN");
  const [payoutName, setPayoutName] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoProvider, setMomoProvider] = useState("MTN");
  const [momoName, setMomoName] = useState("");

  // Learning Preferences
  const [learningGoal, setLearningGoal] = useState("General Exploration");
  const [preferredStyle, setPreferredStyle] = useState("Balanced");

  // Security fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Bank List Dropdown State
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState("");
  const bankList = [
    // Global & US
    "Bank of America", "Barclays", "Citigroup", "Goldman Sachs", "HSBC", "JPMorgan Chase", "Morgan Stanley", "Wells Fargo",
    // Europe & UK
    "BNP Paribas", "Credit Suisse", "Deutsche Bank", "ING Group", "Lloyds Bank", "Santander", "Standard Chartered", "UBS",
    // Pan-African
    "Absa Bank", "Access Bank", "Ecobank", "First Bank of Nigeria", "Guaranty Trust Bank (GTBank)", "Standard Bank", "United Bank for Africa (UBA)", "Zenith Bank",
    // Regional (Ghana)
    "Agricultural Development Bank (ADB)", "Bank of Africa", "CalBank", "Consolidated Bank Ghana (CBG)", "Fidelity Bank", "First Atlantic Bank", "First National Bank", "GCB Bank", "National Investment Bank (NIB)", "Prudential Bank", "Republic Bank", "Societe Generale", "Stanbic Bank", "Universal Merchant Bank (UMB)"
  ].sort();

  // Initialize fields with user data
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
      setEmail(user.email || "");
      setPreferredNotification(user.preferred_notification_method || "auto");
      setPreferredPayment(user.preferred_payment_method || "mobile_money");
      setPayoutMethod(user.payout_method || "mobile_money");
      setPayoutNumber(user.payout_number || "");
      setPayoutProvider(user.payout_provider || "MTN");
      setPayoutName(user.payout_name || "");
      setMomoNumber(user.momo_number || "");
      setMomoProvider(user.momo_provider || "MTN");
      setMomoName(user.momo_name || "");
      setLearningGoal(user.learning_goal || "General Exploration");
      setPreferredStyle(user.preferred_style || "Balanced");
    }
  }, [user]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const payload: Record<string, string | number | boolean | null | undefined> = {};
    if (activeTab === "profile") {
      payload.name = name;
      payload.phone = phone;
      payload.email = email;
      payload.preferred_notification_method = preferredNotification;
    } else if (activeTab === "financial") {
      payload.preferred_payment_method = preferredPayment;
      payload.payout_method = payoutMethod;
      payload.payout_number = payoutNumber;
      payload.payout_provider = payoutProvider;
      payload.payout_name = payoutName;
      payload.momo_number = momoNumber;
      payload.momo_provider = momoProvider;
      payload.momo_name = momoName;
    } else if (activeTab === "learning") {
      payload.learning_goal = learningGoal;
      payload.preferred_style = preferredStyle;
    } else if (activeTab === "security") {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setErrorMsg("All password fields are required.");
        setSaving(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg("New passwords do not match.");
        setSaving(false);
        return;
      }
      payload.current_password = currentPassword;
      payload.new_password = newPassword;
    }

    try {
      const res = await api.put(`${API}/users/profile`, payload);
      if (res.status === 200) {
        setSuccessMsg(
          activeTab === "security"
            ? "Password changed successfully!"
            : "Settings saved successfully!"
        );
        // Clean password fields
        if (activeTab === "security") {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        }
        await refetchUser();
      } else {
        setErrorMsg("Failed to update settings. Please try again.");
      }
    } catch (err: unknown) {
      console.error(err);
      const error = err as {
        response?: {
          data?: {
            detail?: string | Array<{ msg: string }>;
          };
        };
      };
      const detail = error.response?.data?.detail;
      setErrorMsg(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
          ? detail.map((d) => d.msg).join(", ")
          : "An error occurred while saving. Please verify inputs."
      );
    } finally {
      setSaving(false);
    }
  }

  const tabItems = [
    { id: "profile" as TabType, label: "Personal Profile", icon: UserIcon },
    { id: "financial" as TabType, label: "Payout Details", icon: CreditCard },
    { id: "security" as TabType, label: "Security & Access", icon: Lock },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Account Settings</h1>
        <p className="text-gray-400">Configure your profile, learning path options, and financial integrations.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Navigation Tabs */}
        <div className="w-full md:w-64 space-y-1">
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSuccessMsg(null);
                  setErrorMsg(null);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl transition-all duration-300 text-left cursor-pointer border ${
                  isActive
                    ? "bg-primary/10 border-primary/20 text-primary font-bold shadow-md shadow-primary/5"
                    : "bg-card/30 hover:bg-white/5 border-transparent text-gray-400 hover:text-white"
                }`}
              >
                <tab.icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-gray-400"}`} />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Box */}
        <div className="flex-1 w-full bg-card/65 border border-white/10 rounded-3xl glass p-8 shadow-xl relative overflow-visible">
          {/* Status Message Alerts */}
          <AnimatePresence mode="wait">
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-3 text-sm font-medium"
              >
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>{successMsg}</span>
              </motion.div>
            )}

            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-sm font-medium"
              >
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <span>{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {activeTab === "profile" && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-white border-b border-white/5 pb-2">Personal Information</h3>
                
                {/* Meta details */}
                <div className="grid grid-cols-1 gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 text-xs">
                  <div>
                    <span className="text-gray-500 uppercase tracking-widest text-[9px] block">Membership Tier</span>
                    <span className="text-secondary font-bold uppercase tracking-wider">{user?.tier_type || "Public"} Member</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors text-sm"
                      placeholder="Fred Erbah"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors text-sm"
                      placeholder="e.g. 054-XXXX-XXX"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors text-sm"
                    placeholder="john@example.com"
                  />
                  <p className="text-[10px] text-gray-500 mt-2">You can log in with your email or phone number.</p>
                </div>
                
                <div className="pt-2">
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Preferred Notification Method</label>
                  <div className="relative">
                    <select
                      value={preferredNotification}
                      onChange={(e) => setPreferredNotification(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-10 text-white focus:outline-none focus:border-primary transition-colors text-sm appearance-none cursor-pointer"
                    >
                      <option value="auto" className="bg-card text-white">Auto (Smart Routing)</option>
                      <option value="phone" className="bg-card text-white">Phone / SMS / WhatsApp</option>
                      <option value="email" className="bg-card text-white">Email Only</option>
                      <option value="both" className="bg-card text-white">Both Email & Phone</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">How we send you OTPs, alerts, and transaction receipts.</p>
                </div>
              </div>
            )}

            {activeTab === "financial" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Withdrawal Settings</h3>
                  <p className="text-xs text-gray-400 border-b border-white/5 pb-4">Where should we send your earnings when you request a withdrawal?</p>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Select Payout Method</label>
                <div className="relative w-full md:w-1/2">
                  <select
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-10 text-white focus:outline-none focus:border-primary transition-colors text-sm appearance-none cursor-pointer"
                  >
                    <option value="mobile_money" className="bg-card text-white">Mobile Money (MoMo)</option>
                    <option value="bank" className="bg-card text-white">Bank Account (For Card Users)</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
                </div>

                {/* Conditional Fields based on Payout Selection */}
                {payoutMethod === "mobile_money" ? (
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
                    <span className="text-[10px] uppercase font-bold text-primary tracking-widest block mb-2">MoMo Payment Credentials</span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Network Provider</label>
                        <div className="relative">
                          <select
                            value={payoutProvider}
                            onChange={(e) => setPayoutProvider(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-8 text-white focus:outline-none focus:border-primary text-xs appearance-none cursor-pointer"
                          >
                            <option value="MTN" className="bg-card">MTN Ghana</option>
                            <option value="Telecel" className="bg-card">Telecel / Vodafone</option>
                            <option value="AirtelTigo" className="bg-card">AT / AirtelTigo</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">MoMo Number</label>
                        <input
                          type="text"
                          value={payoutNumber}
                          onChange={(e) => setPayoutNumber(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-primary text-xs"
                          placeholder="e.g. 0541234567"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Registered Legal Name</label>
                        <input
                          type="text"
                          value={payoutName}
                          onChange={(e) => setPayoutName(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-primary text-xs"
                          placeholder="Fred Erbah"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
                    <span className="text-[10px] uppercase font-bold text-primary tracking-widest block mb-2">Bank Account Details (Linked to Card)</span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Bank Name</label>
                        <div className="relative">
                          <div className="relative">
                            <input
                              type="text"
                              value={payoutProvider}
                              onChange={(e) => {
                                setPayoutProvider(e.target.value);
                                setBankSearchQuery(e.target.value);
                                setShowBankDropdown(true);
                              }}
                              onFocus={() => {
                                setBankSearchQuery(""); // Clear search to show full list
                                setShowBankDropdown(true);
                              }}
                              onBlur={() => setTimeout(() => setShowBankDropdown(false), 200)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-8 text-white focus:outline-none focus:border-primary text-xs"
                              placeholder="Select or type bank..."
                            />
                            <ChevronDown 
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 cursor-pointer" 
                              onClick={() => {
                                setBankSearchQuery(""); // Clear search to show full list
                                setShowBankDropdown(!showBankDropdown);
                              }}
                            />
                          </div>
                          
                          <AnimatePresence>
                            {showBankDropdown && (
                              <motion.div 
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="absolute z-20 w-full mt-2 bg-[#0B1221] border border-white/10 rounded-xl max-h-48 overflow-y-auto shadow-2xl overflow-hidden"
                              >
                                {bankList.filter(bank => bank.toLowerCase().includes(bankSearchQuery.toLowerCase())).map(bank => (
                                  <div 
                                    key={bank} 
                                    className="px-4 py-3 text-xs text-white hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer border-b border-white/5 last:border-0"
                                    onClick={() => {
                                      setPayoutProvider(bank);
                                      setBankSearchQuery(""); // reset search
                                      setShowBankDropdown(false);
                                    }}
                                  >
                                    {bank}
                                  </div>
                                ))}
                                {bankList.filter(bank => bank.toLowerCase().includes(bankSearchQuery.toLowerCase())).length === 0 && (
                                  <div className="px-4 py-3 text-xs text-gray-500 italic">
                                    Press "Save Settings" to use custom bank "{payoutProvider}"
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Account Number</label>
                        <input
                          type="text"
                          value={payoutNumber}
                          onChange={(e) => setPayoutNumber(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-primary text-xs"
                          placeholder="e.g. 10110023455"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Account Holder Name</label>
                        <input
                          type="text"
                          value={payoutName}
                          onChange={(e) => setPayoutName(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-primary text-xs"
                          placeholder="Fred Erbah"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-white border-b border-white/5 pb-2">Security & Access</h3>

                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-12 text-white focus:outline-none focus:border-primary text-sm font-medium"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-12 text-white focus:outline-none focus:border-primary text-sm font-medium"
                        placeholder="Min. 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 block">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-primary text-sm font-medium"
                      placeholder="Repeat new password"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Action Footer */}
            <div className="flex justify-between items-center border-t border-white/5 pt-6 mt-8">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
                Last updated: {user?.last_active_at ? new Date(user.last_active_at).toLocaleDateString() : "Just now"}
              </span>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 bg-primary hover:bg-primary/95 text-background font-bold px-6 py-3.5 rounded-2xl transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 cursor-pointer shadow-lg shadow-primary/25"
              >
                {saving ? (
                  <>
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Settings</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
