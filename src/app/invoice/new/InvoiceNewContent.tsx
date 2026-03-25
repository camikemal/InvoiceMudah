'use client';

/**
 * InvoiceNewContent — actual client component for /invoice/new
 * Reads ?businessId=xxx from search params, loads business + user settings,
 * renders InvoiceForm, redirects to /business/[id] after save.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import InvoiceForm from '@/components/InvoiceForm';
import Image from 'next/image';
import type { Business, UserSettings } from '@/types/invoice';

export default function InvoiceNewContent() {
  const searchParams  = useSearchParams();
  const businessId    = searchParams.get('businessId') ?? '';
  const router        = useRouter();
  const supabase      = createClient();

  const [userId,       setUserId]       = useState('');
  const [business,     setBusiness]     = useState<Business | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    if (!businessId) { router.push('/dashboard'); return; }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      // Load the business
      const { data: biz } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      if (!biz) { router.push('/dashboard'); return; }
      setBusiness(biz as Business);

      // Load user settings (running number) — create if missing
      const { data: settings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      setUserSettings(
        settings
          ? (settings as UserSettings)
          : { user_id: user.id, last_invoice_number: 0 }
      );

      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const handleDone = () => {
    router.push(`/business/${businessId}`);
  };

  if (loading) return <div className="page-loading"><div className="spinner" />Loading…</div>;
  if (!business || !userSettings) return null;

  return (
    <div className="app-layout">
      <header className="app-header">
        <a href="/dashboard" className="app-logo flex flex-row items-center gap-2">
          <Image src="/logo.jpeg" alt="Invoice Mudah" width={24} height={24} className="rounded-sm object-contain" style={{ width: 'auto', height: 'auto' }} />
          Invoice Mudah
        </a>
        <a href={`/business/${businessId}`} className="app-back">← {business.name}</a>
      </header>

      <main className="app-main">
        <InvoiceForm
          business={business}
          userId={userId}
          userSettings={userSettings}
          onDone={handleDone}
        />
      </main>
    </div>
  );
}
