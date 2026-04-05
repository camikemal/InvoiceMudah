'use client';

/**
 * /business/[id] — Business detail page
 * Shows business info, past invoices, and a "Create Invoice" button.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import BusinessForm from '@/components/BusinessForm';
import Image from 'next/image';
import type { Business, Invoice } from '@/types/invoice';
import { generatePDF } from '@/lib/generatePDF';
import { Eye, Edit, Trash2, X, Download } from 'lucide-react';

interface PastInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  document_type: string;
  total: number;
}

interface InvoiceItemRow {
  id: string;
  item_name: string;
  quantity: number;
  price: number;
  total: number;
}

interface PendingInvoiceDelete {
  id: string;
  invoiceNumber: string;
}

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState('');
  const [business, setBusiness] = useState<Business | null>(null);
  const [invoices, setInvoices] = useState<PastInvoice[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Preview Modal state
  const [showPreview, setShowPreview] = useState(false);
  const [selectedInv, setSelectedInv] = useState<Invoice | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Delete confirmation states
  const [showDeleteBusinessModal, setShowDeleteBusinessModal] = useState(false);
  const [pendingInvoiceDelete, setPendingInvoiceDelete] = useState<PendingInvoiceDelete | null>(null);
  const [deletingBusiness, setDeletingBusiness] = useState(false);
  const [deletingInvoice, setDeletingInvoice] = useState(false);

  useEffect(() => {
    if (!showDeleteBusinessModal && !pendingInvoiceDelete) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (deletingBusiness || deletingInvoice) return;
      setShowDeleteBusinessModal(false);
      setPendingInvoiceDelete(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteBusinessModal, pendingInvoiceDelete, deletingBusiness, deletingInvoice]);

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

  const handleDelete = () => {
    setShowDeleteBusinessModal(true);
  };

  const confirmDeleteBusiness = async () => {
    if (!business) return;

    setDeletingBusiness(true);
    const { error } = await supabase
      .from('businesses')
      .delete()
      .eq('id', id);

    if (error) {
      alert(error.message);
      setDeletingBusiness(false);
    } else {
      router.push('/dashboard');
    }
  };

  const handleOpenPreview = async (invId: string) => {
    if (!business) return;
    setPreviewLoading(true);
    setShowPreview(true);

    // Fetch full invoice data including items
    const { data: inv } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invId)
      .single();

    if (!inv) { setShowPreview(false); setPreviewLoading(false); return; }

    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invId)
      .order('sort_order', { ascending: true });

    const fullInvoice: Invoice = {
      ...inv,
      items: (items || []).map((it: InvoiceItemRow) => ({
        id: it.id,
        item_name: it.item_name,
        quantity: it.quantity,
        price: it.price,
        total: it.total
      }))
    };

    setSelectedInv(fullInvoice);
    setPreviewLoading(false);
  };

  const handleDeleteInvoice = (invId: string, invNum: string) => {
    setPendingInvoiceDelete({ id: invId, invoiceNumber: invNum });
  };

  const confirmDeleteInvoice = async () => {
    if (!pendingInvoiceDelete) return;

    setDeletingInvoice(true);

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', pendingInvoiceDelete.id);

    if (error) {
      alert(error.message);
    } else {
      setInvoices((prev: PastInvoice[]) => prev.filter((i: PastInvoice) => i.id !== pendingInvoiceDelete.id));
      setPendingInvoiceDelete(null);
    }

    setDeletingInvoice(false);
  };

  if (loading) return <div className="page-loading"><div className="spinner" />Loading…</div>;
  if (!business) return null;

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header-left">
          <a href="/dashboard" className="app-logo flex items-center gap-2">
            <Image src="/logo.jpeg" alt="Invoice Mudah" width={24} height={24} className="rounded-sm object-contain" />
            <span>Invoice Mudah</span>
          </a>
        </div>
        <div className="app-header-actions">
          <span className="app-header-title">{business.name}</span>
          <a href="/dashboard" className="app-back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Dashboard
          </a>
        </div>
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
              className="btn btn--danger"
              onClick={handleDelete}
              disabled={loading}
            >
              Delete
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => setEditing(!editing)}
            >
              {editing ? 'Cancel' : 'Edit'}
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
            <div className="table-scroll">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Actions</th>
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
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="btn btn--ghost btn--sm p-0 w-8 h-8"
                            onClick={() => handleOpenPreview(inv.id)}
                            title="Preview PDF"
                          >
                            <Eye size={16} />
                          </button>
                          <a
                            href={`/invoice/edit/${inv.id}`}
                            className="btn btn--ghost btn--sm p-0 w-8 h-8 flex items-center justify-center"
                            title="Edit Invoice"
                          >
                            <Edit size={16} />
                          </a>
                          <button
                            className="btn btn--danger btn--sm p-0 w-8 h-8"
                            onClick={() => handleDeleteInvoice(inv.id, inv.invoice_number)}
                            title="Delete Invoice"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Preview Modal ─────────────────────────────────── */}
        {showPreview && (
          <div className="modal-overlay">
            <div className="modal-content modal-content--large">
              <header className="modal-header">
                <h2>Invoice Preview</h2>
                <button className="modal-close" onClick={() => setShowPreview(false)}>
                  <X size={20} />
                </button>
              </header>
              <div className="modal-body">
                {previewLoading ? (
                  <div className="modal-loading"><div className="spinner" />Fetching details…</div>
                ) : selectedInv ? (
                  <div className="preview-wrap">
                    <div className="preview-card">
                      <div className="preview-header">
                        <div className="preview-header-left">
                          <div className="preview-badge">{selectedInv.document_type}</div>
                          <div className="preview-meta-bold">{selectedInv.document_type} NUMBER: {selectedInv.invoice_number}</div>
                          <div className="preview-meta-bold">DATE: {new Date(selectedInv.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}</div>
                        </div>
                        <div className="preview-header-right">
                          <div className="preview-biz-name" role="heading" aria-level={3}>{business.name}</div>
                          <div className="preview-biz-meta">{business.location}</div>
                          <div className="preview-biz-meta">{business.phone}</div>
                        </div>
                      </div>

                      <div className="preview-section">
                        <div className="preview-section-title">BILL TO</div>
                        <div className="preview-customer">{selectedInv.customer_name}</div>
                        {selectedInv.customer_phone && <div className="preview-meta-bold">{selectedInv.customer_phone}</div>}
                      </div>

                      {selectedInv.description && (
                        <div className="preview-section" style={{ marginTop: '24px' }}>
                          <div className="preview-section-title">DESCRIPTION</div>
                          <div className="preview-desc" style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            {selectedInv.description}
                          </div>
                        </div>
                      )}

                      <div className="preview-table-wrap">
                        <table className="preview-table">
                          <thead>
                            <tr>
                              <th>ITEM</th>
                              <th className="text-center">QTY</th>
                              <th className="text-center">PRICE</th>
                              <th className="text-right">TOTAL</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedInv.items.map((item, idx) => (
                              <tr key={idx}>
                                <td>{item.item_name}</td>
                                <td className="text-center">{item.quantity}</td>
                                <td className="text-center">RM {item.price.toFixed(2)}</td>
                                <td className="text-right">RM {item.total.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="preview-summary">
                        <div className="preview-summary-line">
                          <span>Sub Total</span>
                          <span style={{ color: '#0f172a' }}>RM {selectedInv.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="preview-summary-line">
                          <span>Discount</span>
                          <span style={{ color: '#0f172a' }}>RM {selectedInv.discount.toFixed(2)}</span>
                        </div>
                        <div className="preview-total-row">
                          <span>TOTAL</span>
                          <span>RM {selectedInv.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="p-8 text-center text-gray-500">Failed to load invoice details.</p>
                )}
              </div>
              <footer className="modal-footer">
                <button className="btn btn--ghost" style={{ borderRadius: '12px', padding: '10px 24px' }} onClick={() => setShowPreview(false)}>Close</button>
                <button
                  className="btn btn--primary flex gap-2"
                  style={{ borderRadius: '12px', padding: '10px 24px' }}
                  onClick={() => selectedInv && generatePDF(selectedInv, business)}
                  disabled={previewLoading || !selectedInv}
                >
                  <Download size={18} /> Download PDF
                </button>
              </footer>
            </div>
          </div>
        )}

        {showDeleteBusinessModal && (
          <div
            className="modal-overlay"
            onClick={() => {
              if (deletingBusiness) return;
              setShowDeleteBusinessModal(false);
            }}
            role="presentation"
          >
            <div
              className="modal-content signout-modal-content"
              onClick={event => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-business-title"
              aria-describedby="delete-business-desc"
            >
              <header className="modal-header">
                <h2 id="delete-business-title">Delete business?</h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setShowDeleteBusinessModal(false)}
                  disabled={deletingBusiness}
                  aria-label="Close delete business confirmation"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="signout-modal-body" id="delete-business-desc">
                <p>
                  Are you sure you want to delete <strong>{business.name}</strong>? Existing invoices stay intact,
                  but this business will be removed from your dashboard.
                </p>
              </div>

              <footer className="modal-footer signout-modal-footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowDeleteBusinessModal(false)}
                  disabled={deletingBusiness}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={confirmDeleteBusiness}
                  disabled={deletingBusiness}
                >
                  {deletingBusiness ? 'Deleting…' : 'Delete Business'}
                </button>
              </footer>
            </div>
          </div>
        )}

        {pendingInvoiceDelete && (
          <div
            className="modal-overlay"
            onClick={() => {
              if (deletingInvoice) return;
              setPendingInvoiceDelete(null);
            }}
            role="presentation"
          >
            <div
              className="modal-content signout-modal-content"
              onClick={event => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-invoice-title"
              aria-describedby="delete-invoice-desc"
            >
              <header className="modal-header">
                <h2 id="delete-invoice-title">Delete invoice?</h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setPendingInvoiceDelete(null)}
                  disabled={deletingInvoice}
                  aria-label="Close delete invoice confirmation"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="signout-modal-body" id="delete-invoice-desc">
                <p>
                  Are you sure you want to delete invoice <strong>{pendingInvoiceDelete.invoiceNumber}</strong>?
                </p>
              </div>

              <footer className="modal-footer signout-modal-footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setPendingInvoiceDelete(null)}
                  disabled={deletingInvoice}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={confirmDeleteInvoice}
                  disabled={deletingInvoice}
                >
                  {deletingInvoice ? 'Deleting…' : 'Delete Invoice'}
                </button>
              </footer>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
