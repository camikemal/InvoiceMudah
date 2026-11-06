'use client';

/**
 * InvoiceNewContent — actual client component for /invoice/new
 * Reads ?businessId=xxx from search params, loads business + user settings,
 * renders InvoiceForm, redirects to /business/[id] after save.
 *
 * Conversion: ?from=<invoiceId>&type=INVOICE|RECEIPT prefills the form from
 * an existing quotation / invoice and links the new document to it.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import InvoiceForm from '@/components/InvoiceForm';
import Image from 'next/image';
import { fetchInvoiceWithItems } from '@/lib/invoices';
import { emptyItem, type Business, type DocumentType, type Invoice, type UserSettings } from '@/types/invoice';

const CONVERT_TYPES: DocumentType[] = ['INVOICE', 'RECEIPT'];

export default function InvoiceNewContent() {
  const searchParams  = useSearchParams();
  const businessId    = searchParams.get('businessId') ?? '';
  const fromId        = searchParams.get('from');
  const typeParam     = searchParams.get('type') as DocumentType | null;
  const router        = useRouter();
  const supabase      = createClient();

  const [userId,       setUserId]       = useState('');
  const [business,     setBusiness]     = useState<Business | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [prefill,      setPrefill]      = useState<Invoice | undefined>(undefined);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    if (!businessId) { router.push('/dashboard'); return; }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      const [{ data: biz }, { data: settings }, source] = await Promise.all([
        supabase.from('businesses').select('*').eq('id', businessId).single(),
        supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
        fromId ? fetchInvoiceWithItems(supabase, fromId) : Promise.resolve(null),
      ]);

      if (!biz) { router.push('/dashboard'); return; }
      setBusiness(biz as Business);
      setUserSettings(
        settings
          ? (settings as UserSettings)
          : { user_id: user.id, last_invoice_number: 0 }
      );

      if (source && source.business_id === businessId) {
        const targetType = typeParam && CONVERT_TYPES.includes(typeParam) ? typeParam : 'INVOICE';
        setPrefill({
          ...source,
          id: undefined,
          document_type: targetType,
          status: undefined,
          due_date: null,
          paid_at: null,
          amount_paid: 0,
          source_invoice_id: source.id,
          items: source.items.map(it => ({ ...it, id: emptyItem().id })),
        });
      }

      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, fromId]);

  const handleDone = () => {
    router.push(`/business/${businessId}`);
  };

  if (loading) return <div className="page-loading"><div className="spinner" />Loading…</div>;
  if (!business || !userSettings) return null;

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
          <span className="app-header-title">{prefill ? `New ${prefill.document_type.toLowerCase()}` : 'New Invoice'}</span>
          <a href={`/business/${businessId}`} className="app-back-link">← {business.name}</a>
        </div>
      </header>

      <main className="app-main">
        <InvoiceForm
          business={business}
          userId={userId}
          userSettings={userSettings}
          initialData={prefill}
          onDone={handleDone}
        />
      </main>
    </div>
  );
}
