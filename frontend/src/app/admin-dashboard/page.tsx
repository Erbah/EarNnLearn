'use client';
import { useState, useEffect } from 'react';
import AdminDashboard from '@/components/AdminDashboard';

export default function AdminDashboardPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem('admin_unlocked') === 'true') {
      setUnlocked(true);
    } else {
      // Redirect to standalone login portal if not unlocked
      window.location.href = '/admin-login';
    }
  }, []);

  if (!mounted) return (
    <div className="flex items-center justify-center min-h-[70vh] text-gray-500 animate-pulse font-mono bg-background">
      Initializing Security Layer...
    </div>
  );

  if (!unlocked) return null; // Wait for redirect or state sync

  return <AdminDashboard />;
}
