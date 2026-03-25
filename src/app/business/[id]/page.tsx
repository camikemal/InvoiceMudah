'use client';

/**
 * /business/[id] — Business detail page
 * Shows business info, past invoices, and a "Create Invoice" button.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import BusinessForm from '@/components/BusinessForm';
import type { Business } from '@/types/invoice';

interface PastInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  document_type: string;
  total: number;
}

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [userId,   setUserId]   = useState('');
  const [business, setBusiness] = useState<Business | null>(null);
  const [invoices, setInvoices] = useState<PastInvoice[]>([]);
  const [editing,  setEditing]  = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      // Load business
      const { data: biz } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', id)
        .single();
      if (!biz) { router.push('/dashboard'); return; }
      setBusiness(biz as Business);

      // Load past invoices for this business
      const { data: invs } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, customer_name, document_type, total')
        .eq('business_id', id)
        .order('created_at', { ascending: false });
      setInvoices((invs ?? []) as PastInvoice[]);

      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleBusinessUpdated = (updated: Business) => {
    setBusiness(updated);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!business) return;
    if (!window.confirm(`Are you sure you want to delete "${business.name}"? This business won't show on old invoices.`)) return;

    setLoading(true);
    const { error } = await supabase
      .from('businesses')
      .delete()
      .eq('id', id);

    if (error) {
      alert(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" />Loading…</div>;
  if (!business) return null;

  return (
    <div className="app-layout">
      <header className="app-header">
        <a href="/dashboard" className="app-logo">InvoiceMudah</a>
        <a href="/dashboard" className="app-back">← Dashboard</a>
      </header>

      <main className="app-main">

        {/* ── Business Info Section ─────────────────────────── */}
        <div className="biz-detail-header">
          <div>
            <h1 className="biz-detail-name">{business.name}</h1>
            <p className="biz-detail-meta">{business.location}</p>
            <p className="biz-detail-meta">{business.phone}</p>
          </div>
          <div className="biz-detail-actions">
            <button
              className="btn btn--ghost"
              onClick={() => setEditing(!editing)}
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <button
              className="btn btn--danger"
              onClick={handleDelete}
              disabled={loading}
            >
              Delete
            </button>
            <a
              href={`/invoice/new?businessId=${id}`}
              className="btn btn--primary"
            >
              + Create Invoice
            </a>
          </div>
        </div>

        {/* ── Payment & Terms (collapsed info) ─────────────── */}
        {!editing && (
          <div className="biz-info-row">
            {business.bank && (
              <div className="biz-info-chip">
                <span className="biz-info-label">Bank</span>
                <span>{business.bank}</span>
              </div>
            )}
            {business.account_name && (
              <div className="biz-info-chip">
                <span className="biz-info-label">Account</span>
                <span>{business.account_name} · {business.account_number}</span>
              </div>
            )}
            {business.terms && (
              <div className="biz-info-chip biz-info-chip--wide">
                <span className="biz-info-label">Terms</span>
                <span>{business.terms}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Inline Edit Form ──────────────────────────────── */}
        {editing && (
          <div className="biz-edit-wrap">
            <BusinessForm
              initialData={business}
              userId={userId}
              mode="edit"
              onSave={handleBusinessUpdated}
              onCancel={() => setEditing(false)}
            />
          </div>
        )}

        {/* ── Past Invoices ─────────────────────────────────── */}
        <section className="past-invoices">
          <div className="section-heading">
            <h2>Past Invoices</h2>
            <span className="section-count">{invoices.length} record{invoices.length !== 1 ? 's' : ''}</span>
          </div>

          {invoices.length === 0 ? (
            <div className="empty-state">
              <p>No invoices yet.</p>
              <a href={`/invoice/new?businessId=${id}`} className="btn btn--primary">
                Create First Invoice
              </a>
            </div>
          ) : (
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="inv-table-num">{inv.invoice_number}</td>
                    <td>{new Date(inv.invoice_date).toLocaleDateString('en-GB')}</td>
                    <td>{inv.customer_name}</td>
                    <td>
                      <span className={`doc-badge doc-badge--${inv.document_type.toLowerCase()}`}>
                        {inv.document_type}
                      </span>
                    </td>
                    <td className="text-right">RM {Number(inv.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
