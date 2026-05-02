'use client';
import { useState, useEffect } from 'react';
import AdminDashboard from '@/components/AdminDashboard';
import { UserProvider } from '@/context/UserContext';
import { AdminSidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

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

  return (
    <UserProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <AdminSidebar />
        <div className="flex-1 ml-64 flex flex-col relative overflow-x-hidden">
          <div className="absolute top-0 left-0 w-full h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 opacity-50 pointer-events-none" />
          <Topbar />
          <main className="flex-1 px-8 py-8 w-full z-10">
            <AdminDashboard />
          </main>
        </div>
      </div>
    </UserProvider>
  );
}
