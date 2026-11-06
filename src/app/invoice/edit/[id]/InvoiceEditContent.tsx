'use client';

/**
 * InvoiceEditContent — actual client component for /invoice/edit/[id]
 * Fetches invoice + items, then renders InvoiceForm in edit mode.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import InvoiceForm from '@/components/InvoiceForm';
import Image from 'next/image';
import { fetchInvoiceWithItems } from '@/lib/invoices';
import type { Business, UserSettings, Invoice } from '@/types/invoice';

export default function InvoiceEditContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [userId,       setUserId]       = useState('');
  const [business,     setBusiness]     = useState<Business | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [initialData,  setInitialData]  = useState<Invoice | null>(null);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    if (!id) { router.push('/dashboard'); return; }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      // 1. Load the invoice with its items
      const inv = await fetchInvoiceWithItems(supabase, id);
      if (!inv) { router.push('/dashboard'); return; }

      // 2. Load the business
      const { data: biz } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', inv.business_id)
        .single();
      if (!biz) { router.push('/dashboard'); return; }
      setBusiness(biz as Business);

      // 3. Load user settings
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

      setInitialData(inv);

      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDone = () => {
    if (business?.id) {
      router.push(`/business/${business.id}`);
    } else {
      router.push('/dashboard');
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" />Loading…</div>;
  if (!business || !userSettings || !initialData) return null;

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header-left">
          <a href="/dashboard" className="app-logo flex flex-row items-center gap-2">
            <Image src="/logo.jpeg" alt="Invoice Mudah" width={24} height={24} className="rounded-sm object-contain" style={{ width: 'auto', height: 'auto' }} />
            Invoice Mudah
          </a>
        </div>
        <div className="app-header-actions">
          <span className="app-header-title">Edit Invoice</span>
          <a href={`/business/${business.id}`} className="app-back-link">← {business.name}</a>
        </div>
      </header>

      <main className="app-main">
        <InvoiceForm
          business={business}
          userId={userId}
          userSettings={userSettings}
          initialData={initialData}
          mode="edit"
          onDone={handleDone}
        />
      </main>
    </div>
  );
}
