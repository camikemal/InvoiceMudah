'use client';

/**
 * /business/new — create a new business
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import BusinessForm from '@/components/BusinessForm';
import Image from 'next/image';
import type { Business } from '@/types/invoice';

export default function NewBusinessPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = (biz: Business) => {
    router.push(`/business/${biz.id}`);
  };

  if (!userId) return <div className="page-loading"><div className="spinner" />Loading…</div>;

  return (
    <div className="app-layout">
      <header className="app-header flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="app-logo flex items-center gap-2">
            <Image src="/logo.jpeg" alt="Invoice Mudah" width={24} height={24} className="rounded-sm object-contain" />
            <span className="hidden sm:inline">Invoice Mudah</span>
          </a>
          <div className="h-6 w-px bg-gray-200"></div>
          <a href="/dashboard" className="-ml-3 flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 py-1.5 px-3 rounded-lg border border-gray-200 transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back to Dashboard
          </a>
        </div>
        <div className="text-sm font-bold text-gray-800">New Business</div>
      </header>

      <main className="app-main app-main--narrow">
        <div className="page-heading">
          <h1>New Business</h1>
          <p className="page-sub">This info will appear on every invoice for this business.</p>
        </div>
        <BusinessForm
          userId={userId}
          mode="create"
          onSave={handleSave}
          onCancel={() => router.push('/dashboard')}
        />
      </main>
    </div>
  );
}
