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
      <header className="app-header">
        <a href="/dashboard" className="app-logo flex flex-row items-center gap-2">
          <Image src="/logo.jpeg" alt="Invoice Mudah" width={24} height={24} className="rounded-sm object-contain" style={{ width: 'auto', height: 'auto' }} />
          Invoice Mudah
        </a>
        <a href="/dashboard" className="app-back">← Dashboard</a>
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
