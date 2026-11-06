'use client';

/**
 * /business/[id] — Business detail page
 * Shows business info, summary stats, documents (with filters, payment
 * tracking and conversion), saved customers, and a "Create Invoice" button.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import BusinessForm from '@/components/BusinessForm';
import CustomersPanel from '@/components/CustomersPanel';
import MarkPaidModal from '@/components/MarkPaidModal';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import Image from 'next/image';
import type { Business, Invoice } from '@/types/invoice';
import { BUSINESS_TYPES, displayStatus, formatRM, type DisplayStatus } from '@/types/invoice';
import { generatePDF } from '@/lib/generatePDF';
import { fetchInvoiceWithItems, friendlyDbError } from '@/lib/invoices';
import { computeTotals, currentMonthKey, SUMMARY_COLUMNS, type InvoiceSummary } from '@/lib/stats';
import { downloadInvoicesCsv } from '@/lib/csv';
import { Eye, Edit, Trash2, X, Download, CircleDollarSign, FileOutput, Receipt } from 'lucide-react';

interface PendingInvoiceDelete {
  id: string;
  invoiceNumber: string;
}

type StatusFilter = 'ALL' | 'OUTSTANDING' | 'OVERDUE' | 'PAID' | 'DRAFT';
type TypeFilter = 'ALL' | 'INVOICE' | 'RECEIPT' | 'QUOTATION';
type Tab = 'documents' | 'customers';

const STATUS_FILTERS: { value: StatusFilter; label: string; match: (s: DisplayStatus) => boolean }[] = [
  { value: 'ALL',         label: 'All',         match: () => true },
  { value: 'OUTSTANDING', label: 'Outstanding', match: s => s === 'UNPAID' || s === 'PARTIAL' || s === 'OVERDUE' },
  { value: 'OVERDUE',     label: 'Overdue',     match: s => s === 'OVERDUE' },
  { value: 'PAID',        label: 'Paid',        match: s => s === 'PAID' },
  { value: 'DRAFT',       label: 'Quotations',  match: s => s === 'DRAFT' },
];

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();

  const [userId, setUserId] = useState('');
  const [business, setBusiness] = useState<Business | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('documents');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Preview Modal state
  const [showPreview, setShowPreview] = useState(false);
  const [selectedInv, setSelectedInv] = useState<Invoice | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Payment modal
  const [paymentFor, setPaymentFor] = useState<InvoiceSummary | null>(null);

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

      const [{ data: biz }, { data: invs, error: invErr }] = await Promise.all([
        supabase.from('businesses').select('*').eq('id', id).single(),
        supabase
          .from('invoices')
          .select(SUMMARY_COLUMNS)
          .eq('business_id', id)
          .order('invoice_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);
      if (!biz) { router.push('/dashboard'); return; }
      setBusiness(biz as Business);
      if (invErr) toast.error(friendlyDbError(invErr));
      setInvoices((invs ?? []) as InvoiceSummary[]);

      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totals = useMemo(() => computeTotals(invoices), [invoices]);
  const monthTotals = useMemo(() => {
    const key = currentMonthKey();
    return computeTotals(invoices.filter(i => i.invoice_date.startsWith(key)));
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const statusMatch = STATUS_FILTERS.find(f => f.value === statusFilter)!.match;
    return invoices.filter(inv => {
      if (typeFilter !== 'ALL' && inv.document_type !== typeFilter) return false;
      if (dateFrom && inv.invoice_date < dateFrom) return false;
      if (dateTo && inv.invoice_date > dateTo) return false;
      if (!statusMatch(displayStatus(inv))) return false;
      if (q) {
        const hay = `${inv.invoice_number} ${inv.customer_name} ${inv.customer_phone ?? ''} ${inv.customer_email ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, search, statusFilter, typeFilter, dateFrom, dateTo]);

  const filtersActive = search || statusFilter !== 'ALL' || typeFilter !== 'ALL' || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const handleBusinessUpdated = (updated: Business) => {
    setBusiness(updated);
    setEditing(false);
    toast.success('Business updated');
  };

  const confirmDeleteBusiness = async () => {
    if (!business) return;

    setDeletingBusiness(true);
    const { error } = await supabase
      .from('businesses')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error(friendlyDbError(error));
      setDeletingBusiness(false);
    } else {
      router.push('/dashboard');
    }
  };

  const handleOpenPreview = async (invId: string) => {
    if (!business) return;
    setPreviewLoading(true);
    setShowPreview(true);

    const fullInvoice = await fetchInvoiceWithItems(supabase, invId);
    if (!fullInvoice) {
      setShowPreview(false);
      setPreviewLoading(false);
      toast.error('Could not load this document.');
      return;
    }

    setSelectedInv(fullInvoice);
    setPreviewLoading(false);
  };

  const confirmDeleteInvoice = async () => {
    if (!pendingInvoiceDelete) return;

    setDeletingInvoice(true);

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', pendingInvoiceDelete.id);

    if (error) {
      toast.error(friendlyDbError(error));
    } else {
      setInvoices(prev => prev.filter(i => i.id !== pendingInvoiceDelete.id));
      toast.success(`${pendingInvoiceDelete.invoiceNumber} deleted`);
      setPendingInvoiceDelete(null);
    }

    setDeletingInvoice(false);
  };

  const handlePaymentUpdated = (patch: Partial<InvoiceSummary>) => {
    if (!paymentFor) return;
    setInvoices(prev => prev.map(i => (i.id === paymentFor.id ? { ...i, ...patch } : i)));
    toast.success(patch.status === 'PAID' ? 'Marked as paid' : patch.status === 'PARTIAL' ? 'Partial payment recorded' : 'Marked as unpaid');
    setPaymentFor(null);
  };

  const handleExport = () => {
    if (!business) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadInvoicesCsv(filtered, `${business.name.replace(/[^\w-]+/g, '_')}_${stamp}.csv`);
  };

  if (loading) return <div className="page-loading"><div className="spinner" />Loading…</div>;
  if (!business) return null;

  const typeLabel = BUSINESS_TYPES.find(t => t.value === business.business_type)?.label;

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
            {typeLabel && <span className="biz-type-tag">{typeLabel}</span>}
            <p className="biz-detail-meta">{business.location}</p>
            <p className="biz-detail-meta">{business.phone}</p>
          </div>
          <div className="biz-detail-actions">
            <button
              className="btn btn--danger"
              onClick={() => setShowDeleteBusinessModal(true)}
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

        {/* ── Summary stats ─────────────────────────────────── */}
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-label">Billed this month</span>
            <span className="stat-value">{formatRM(monthTotals.billed)}</span>
            <span className="stat-sub">Collected {formatRM(monthTotals.collected)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Outstanding</span>
            <span className="stat-value">{formatRM(totals.outstanding)}</span>
            <span className="stat-sub">All time</span>
          </div>
          <div className={`stat-card${totals.overdueCount ? ' stat-card--alert' : ''}`}>
            <span className="stat-label">Overdue</span>
            <span className="stat-value">{totals.overdueCount}</span>
            <span className="stat-sub">{formatRM(totals.overdueAmount)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total billed</span>
            <span className="stat-value">{formatRM(totals.billed)}</span>
            <span className="stat-sub">{invoices.length} document{invoices.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────── */}
        <div className="tab-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'documents'}
            className={`tab-btn${tab === 'documents' ? ' tab-btn--active' : ''}`}
            onClick={() => setTab('documents')}
          >
            Documents
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'customers'}
            className={`tab-btn${tab === 'customers' ? ' tab-btn--active' : ''}`}
            onClick={() => setTab('customers')}
          >
            Customers
          </button>
        </div>

        {tab === 'customers' && (
          <CustomersPanel businessId={id} userId={userId} invoices={invoices} />
        )}

        {/* ── Documents ─────────────────────────────────────── */}
        {tab === 'documents' && (
        <section className="past-invoices">
          <div className="section-heading">
            <h2>Documents</h2>
            <span className="section-count">
              {filtersActive ? `${filtered.length} of ${invoices.length}` : invoices.length} record{invoices.length !== 1 ? 's' : ''}
            </span>
          </div>

          {invoices.length > 0 && (
            <>
              <div className="chip-group" role="group" aria-label="Filter by status">
                {STATUS_FILTERS.map(f => (
                  <button
                    key={f.value}
                    type="button"
                    className={`chip${statusFilter === f.value ? ' chip--active' : ''}`}
                    onClick={() => setStatusFilter(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="filter-bar">
                <input
                  className="filter-search"
                  placeholder="Search number, customer, phone…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="Search documents"
                />
                <select
                  className="filter-select"
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value as TypeFilter)}
                  aria-label="Filter by type"
                >
                  <option value="ALL">All types</option>
                  <option value="INVOICE">Invoices</option>
                  <option value="RECEIPT">Receipts</option>
                  <option value="QUOTATION">Quotations</option>
                </select>
                <input
                  type="date"
                  className="filter-date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  aria-label="From date"
                />
                <input
                  type="date"
                  className="filter-date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={e => setDateTo(e.target.value)}
                  aria-label="To date"
                />
                {filtersActive && (
                  <button type="button" className="btn btn--ghost" onClick={clearFilters}>Clear</button>
                )}
                <button type="button" className="btn btn--ghost" onClick={handleExport} disabled={filtered.length === 0}>
                  <Download size={14} /> CSV
                </button>
              </div>
            </>
          )}

          {invoices.length === 0 ? (
            <div className="empty-state">
              <p>No invoices yet.</p>
              <a href={`/invoice/new?businessId=${id}`} className="btn btn--primary">
                Create First Invoice
              </a>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <p>No documents match these filters.</p>
              <button type="button" className="btn btn--ghost" onClick={clearFilters}>Clear filters</button>
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
                    <th>Status</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => {
                    const status = displayStatus(inv);
                    const canPay = inv.document_type === 'INVOICE' && inv.status !== 'CANCELLED';
                    return (
                    <tr key={inv.id}>
                      <td className="inv-table-num">{inv.invoice_number}</td>
                      <td>
                        {new Date(inv.invoice_date).toLocaleDateString('en-GB')}
                        {inv.due_date && inv.document_type === 'INVOICE' && (
                          <div className={`cell-sub${status === 'OVERDUE' ? ' cell-sub--alert' : ''}`}>
                            Due {new Date(inv.due_date).toLocaleDateString('en-GB')}
                          </div>
                        )}
                      </td>
                      <td>{inv.customer_name}</td>
                      <td>
                        <span className={`doc-badge doc-badge--${inv.document_type.toLowerCase()}`}>
                          {inv.document_type}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={status} />
                        {status === 'PARTIAL' && (
                          <div className="cell-sub">{formatRM(inv.amount_paid)} paid</div>
                        )}
                      </td>
                      <td className="text-right">{formatRM(inv.total)}</td>
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
                          {canPay && (
                            <button
                              className={`btn btn--ghost btn--sm p-0 w-8 h-8${status === 'PAID' ? ' btn--success' : ''}`}
                              onClick={() => setPaymentFor(inv)}
                              title={status === 'PAID' ? 'Payment details' : 'Record payment'}
                            >
                              <CircleDollarSign size={16} />
                            </button>
                          )}
                          {inv.document_type === 'QUOTATION' && (
                            <a
                              href={`/invoice/new?businessId=${id}&from=${inv.id}&type=INVOICE`}
                              className="btn btn--ghost btn--sm p-0 w-8 h-8 flex items-center justify-center"
                              title="Convert to Invoice"
                            >
                              <FileOutput size={16} />
                            </a>
                          )}
                          {inv.document_type === 'INVOICE' && inv.status !== 'CANCELLED' && (
                            <a
                              href={`/invoice/new?businessId=${id}&from=${inv.id}&type=RECEIPT`}
                              className="btn btn--ghost btn--sm p-0 w-8 h-8 flex items-center justify-center"
                              title="Issue Receipt"
                            >
                              <Receipt size={16} />
                            </a>
                          )}
                          <button
                            className="btn btn--danger btn--sm p-0 w-8 h-8"
                            onClick={() => setPendingInvoiceDelete({ id: inv.id, invoiceNumber: inv.invoice_number })}
                            title="Delete Invoice"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        )}

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
                          <div className="flex gap-2 items-center">
                            <div className="preview-badge">{selectedInv.document_type}</div>
                            <StatusBadge status={displayStatus(selectedInv)} />
                          </div>
                          <div className="preview-meta-bold">{selectedInv.document_type} NUMBER: {selectedInv.invoice_number}</div>
                          <div className="preview-meta-bold">DATE: {new Date(selectedInv.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}</div>
                          {selectedInv.due_date && selectedInv.document_type === 'INVOICE' && (
                            <div className="preview-meta-bold">DUE: {new Date(selectedInv.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}</div>
                          )}
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
                        {selectedInv.customer_email && <div className="preview-meta-bold">{selectedInv.customer_email}</div>}
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
                                <td className="text-center">{formatRM(item.price)}</td>
                                <td className="text-right">{formatRM(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="preview-summary">
                        <div className="preview-summary-line">
                          <span>Sub Total</span>
                          <span style={{ color: '#0f172a' }}>{formatRM(selectedInv.subtotal)}</span>
                        </div>
                        <div className="preview-summary-line">
                          <span>Discount</span>
                          <span style={{ color: '#0f172a' }}>{formatRM(selectedInv.discount)}</span>
                        </div>
                        <div className="preview-total-row">
                          <span>TOTAL</span>
                          <span>{formatRM(selectedInv.total)}</span>
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

        {paymentFor && (
          <MarkPaidModal
            invoice={paymentFor}
            onClose={() => setPaymentFor(null)}
            onUpdated={handlePaymentUpdated}
          />
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
                  but this business and its saved customers will be removed from your dashboard.
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
