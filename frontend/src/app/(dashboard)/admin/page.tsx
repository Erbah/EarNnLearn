'use client';

import AdminDashboard from '@/components/AdminDashboard';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'SUPER_ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500 animate-pulse font-mono">
        Verifying Security Credentials...
      </div>
    );
  }

  return <AdminDashboard />;
}

