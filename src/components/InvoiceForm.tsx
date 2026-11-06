'use client';

/**
 * InvoiceForm Component
 * ─────────────────────────────────────────────────────────────
 * Features:
 *  • Document type picker: INVOICE / RECEIPT / QUOTATION
 *  • Running number input (user sets current → next = current+1)
 *  • Invoice number format: "TYPE N - BIZNAME"
 *  • Saved-customer autocomplete, optional "save as customer"
 *  • Due date for invoices (defaults from business settings)
 *  • Atomic save via the save_invoice RPC
 */

import { useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import ItemList from '@/components/ItemList';
import CustomerAutocomplete from '@/components/CustomerAutocomplete';
import { generatePDF } from '@/lib/generatePDF';
import { fetchNextRunningNumber, friendlyDbError, saveInvoice } from '@/lib/invoices';
import { firstError, invoiceSchema } from '@/lib/validation';
import type { Business, Customer, Invoice, InvoiceItem, UserSettings } from '@/types/invoice';
import {
  BUSINESS_TYPE_DEFAULTS,
  addDaysISO,
  defaultStatusFor,
  emptyItem,
  formatInvoiceNumber,
  formatRM,
  parseRunningNumber,
  todayISO,
  type DocumentType,
} from '@/types/invoice';

const DOC_TYPES: DocumentType[] = ['INVOICE', 'RECEIPT', 'QUOTATION'];

interface InvoiceFormProps {
  business: Business;
  userId: string;
  userSettings: UserSettings;
  /** Existing invoice data for editing, or prefill data (no id) when converting */
  initialData?: Invoice;
  /** 'new' (default) or 'edit' */
  mode?: 'new' | 'edit';
  /** Called after successful save — parent navigates away */
  onDone: () => void;
}

function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    .toUpperCase();
}

export default function InvoiceForm({
  business,
  userId,
  userSettings,
  initialData,
  mode = 'new',
  onDone,
}: InvoiceFormProps) {
  const supabase = createClient();
  const typeDefaults = BUSINESS_TYPE_DEFAULTS[business.business_type ?? 'HOMESTAY'];

  // ── Document type & date ──────────────────────────────────────
  const [docType, setDocType] = useState<DocumentType>(initialData?.document_type || 'INVOICE');
  const [invoiceDate, setInvoiceDate] = useState(
    mode === 'edit' && initialData?.invoice_date ? initialData.invoice_date : todayISO(),
  );
  const dueDays = business.default_due_days ?? 0;
  const [dueDate, setDueDate] = useState<string>(
    initialData?.due_date ?? (dueDays > 0 ? addDaysISO(invoiceDate, dueDays) : ''),
  );

  // ── Running number ────────────────────────────────────────────
  // currentNumber = the LAST used number (from user_settings)
  // nextNumber    = currentNumber + 1 (this is what we'll assign)
  // If editing, we use the number from initialData but stripped of the prefix
  const getInitialNumber = () => {
    if (mode === 'edit' && initialData) {
      const n = parseRunningNumber(initialData.invoice_number);
      if (n !== null) return n - 1;
    }
    return userSettings.last_invoice_number;
  };

  const [currentNumber, setCurrentNumber] = useState(getInitialNumber());
  const nextNumber    = currentNumber + 1;
  const invoiceNumber = formatInvoiceNumber(docType, business.name, nextNumber);

  // ── Customer details ──────────────────────────────────────────
  const [customerId,    setCustomerId]    = useState<string | null>(initialData?.customer_id ?? null);
  const [customerName,  setCustomerName]  = useState(initialData?.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(initialData?.customer_phone || '');
  const [customerEmail, setCustomerEmail] = useState(initialData?.customer_email || '');
  const [saveCustomer,  setSaveCustomer]  = useState(false);
  const [description,   setDescription]  = useState(
    initialData?.description ?? business.default_description ?? typeDefaults.description,
  );

  // ── Line items ────────────────────────────────────────────────
  const [items, setItems] = useState<InvoiceItem[]>(initialData?.items?.length ? initialData.items : [emptyItem()]);

  // ── Discount ──────────────────────────────────────────────────
  const [discount, setDiscount] = useState(initialData?.discount || 0);

  // ── UI state ──────────────────────────────────────────────────
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  // ── Calculations ──────────────────────────────────────────────
  const subtotal   = items.reduce((s, i) => s + i.total, 0);
  const finalTotal = Math.max(0, subtotal - discount);

  // ── Item handlers ─────────────────────────────────────────────
  const handleAddItem = useCallback(() => setItems(p => [...p, emptyItem()]), []);

  const handleRemoveItem = useCallback(
    (idx: number) => setItems(p => p.filter((_, i) => i !== idx)),
    []
  );

  const handleItemChange = useCallback(
    (idx: number, field: keyof InvoiceItem, value: string | number) => {
      setItems(prev =>
        prev.map((item, i) => {
          if (i !== idx) return item;
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'price') {
            updated.total = Math.round(Number(updated.quantity) * Number(updated.price) * 100) / 100;
          }
          return updated;
        })
      );
    },
    []
  );

  const handleSelectCustomer = (c: Customer) => {
    setCustomerId(c.id);
    setCustomerName(c.name);
    setCustomerPhone(c.phone ?? '');
    setCustomerEmail(c.email ?? '');
    setSaveCustomer(false);
  };

  const handleDocTypeChange = (t: DocumentType) => {
    setDocType(t);
    if (t !== 'INVOICE') setDueDate('');
    else if (!dueDate && dueDays > 0) setDueDate(addDaysISO(invoiceDate, dueDays));
  };

  // ── Build invoice object ──────────────────────────────────────
  const buildInvoice = (): Invoice => {
    const status =
      mode === 'edit' && initialData?.status && initialData.document_type === docType
        ? initialData.status
        : defaultStatusFor(docType);
    return {
      id:             mode === 'edit' ? initialData?.id : undefined,
      user_id:        userId,
      business_id:    business.id,
      invoice_number: invoiceNumber,
      invoice_date:   invoiceDate,
      document_type:  docType,
      customer_id:    customerId,
      customer_name:  customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_email: customerEmail.trim() || null,
      description,
      items,
      subtotal,
      discount,
      total: finalTotal,
      status,
      due_date:          docType === 'INVOICE' && dueDate ? dueDate : null,
      paid_at:           mode === 'edit' ? initialData?.paid_at ?? null : null,
      amount_paid:       mode === 'edit' ? initialData?.amount_paid ?? 0 : 0,
      source_invoice_id: initialData?.source_invoice_id ?? null,
    };
  };

  // ── Save to Supabase ──────────────────────────────────────────
  const handleSave = async () => {
    const invoice = buildInvoice();
    const validationError = firstError(invoiceSchema, invoice);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setSaving(true);

    try {
      if (saveCustomer && !customerId && business.id) {
        const { data: cust, error: custErr } = await supabase
          .from('customers')
          .insert({
            user_id:     userId,
            business_id: business.id,
            name:        invoice.customer_name,
            phone:       invoice.customer_phone || null,
            email:       invoice.customer_email || null,
          })
          .select('id')
          .single();
        if (custErr) throw custErr;
        invoice.customer_id = cust.id;
        setCustomerId(cust.id);
      }

      await saveInvoice(supabase, invoice, mode === 'new' ? nextNumber : null);

      // Issuing a receipt for an invoice settles that invoice
      if (mode === 'new' && docType === 'RECEIPT' && invoice.source_invoice_id) {
        await supabase
          .from('invoices')
          .update({ status: 'PAID', amount_paid: invoice.total, paid_at: invoice.invoice_date })
          .eq('id', invoice.source_invoice_id)
          .eq('document_type', 'INVOICE');
      }

      setSaved(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === '23505' && mode === 'new') {
        const next = await fetchNextRunningNumber(supabase);
        if (next !== null && next - 1 > currentNumber) setCurrentNumber(next - 1);
      }
      setError(friendlyDbError(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Download PDF Only ─────────────────────────────────────────
  const handleDownload = () => {
    generatePDF(buildInvoice(), business);
  };

  // ── Post-save state ───────────────────────────────────────────
  if (saved) {
    const label = docType.charAt(0) + docType.slice(1).toLowerCase();
    return (
      <div className="invoice-saved-screen">
        <div className="invoice-saved-icon">✓</div>
        <h2>{label} {mode === 'edit' ? 'Updated' : 'Saved'}</h2>
        <p className="invoice-saved-num">{invoiceNumber}</p>
        <p className="invoice-saved-sub">
          The record is {mode === 'edit' ? 'updated' : 'saved'} to your account. You can download the PDF anytime.
        </p>
        <div className="flex gap-2">
          <button className="btn btn--secondary" onClick={handleDownload}>
            ⬇ Download PDF
          </button>
          <button className="btn btn--primary" onClick={onDone}>
            ← Back to {business.name}
          </button>
        </div>
      </div>
    );
  }

  // ── Render form ───────────────────────────────────────────────
  return (
    <div className="inv-form">

      {/* ── Header preview ──────────────────────────────────── */}
      <div className="inv-header-preview">
        <div className="inv-header-left">
          {/* Document type selector */}
          <div className="doc-type-group">
            {DOC_TYPES.map(t => (
              <button
                key={t}
                type="button"
                className={`doc-type-btn${docType === t ? ' doc-type-btn--active' : ''}`}
                onClick={() => handleDocTypeChange(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="inv-header-meta">INV NO: {invoiceNumber}</div>
          <div className="inv-header-meta">DATE: {formatDisplayDate(invoiceDate)}</div>
        </div>
        <div className="inv-header-right">
          <div className="inv-biz-name">{business.name}</div>
          <div className="inv-biz-meta">{business.location}</div>
          <div className="inv-biz-meta">{business.phone}</div>
        </div>
      </div>

      {initialData?.source_invoice_id && mode === 'new' && (
        <p className="form-info">
          Converting from <strong>{initialData.invoice_number}</strong>. Review the details, then save.
        </p>
      )}

      {/* ── Running number ───────────────────────────────────── */}
      <div className="inv-section">
        <div className="running-number-row">
          <div>
            <label className="field-label">Current Running Number</label>
            <p className="running-hint">Enter the last number used. Next invoice will be <strong>{nextNumber}</strong>.</p>
          </div>
          <div className="running-input-wrap">
            <input
              id="inv-running-number"
              type="number"
              min={0}
              className="running-input"
              value={currentNumber === 0 ? '' : currentNumber}
              placeholder="0"
              onChange={e => setCurrentNumber(Math.max(0, parseInt(e.target.value) || 0))}
            />
            <span className="running-preview">→ {invoiceNumber}</span>
          </div>
        </div>
      </div>

      {/* ── Dates ────────────────────────────────────────────── */}
      <div className="inv-section">
        <div className="inv-row-2">
          <div className="form-field">
            <label htmlFor="inv-date">{docType === 'QUOTATION' ? 'Quotation Date' : 'Date'}</label>
            <input
              id="inv-date"
              type="date"
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value || todayISO())}
            />
          </div>
          {docType === 'INVOICE' && (
            <div className="form-field">
              <label htmlFor="inv-due-date">Due Date (Optional)</label>
              <input
                id="inv-due-date"
                type="date"
                min={invoiceDate}
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Bill To ──────────────────────────────────────────── */}
      <div className="inv-section">
        <h3 className="inv-section-title">BILL TO</h3>
        <div className="inv-row-2">
          <div className="form-field-stack">
            <div className="form-field">
              <label htmlFor="inv-customer-name">Customer Name *</label>
              {business.id ? (
                <CustomerAutocomplete
                  businessId={business.id}
                  value={customerName}
                  selectedId={customerId}
                  onChangeName={name => {
                    setCustomerName(name);
                    setCustomerId(null);
                  }}
                  onSelect={handleSelectCustomer}
                />
              ) : (
                <input
                  id="inv-customer-name"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                />
              )}
            </div>
            <div className="form-field">
              <label htmlFor="inv-customer-email">Customer Email (Optional)</label>
              <input
                id="inv-customer-email"
                type="email"
                placeholder="e.g. customer@email.com"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="form-field-stack">
            <div className="form-field">
              <label htmlFor="inv-customer-phone">Customer Phone</label>
              <input
                id="inv-customer-phone"
                placeholder="e.g. 018-765 4321"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
              />
            </div>
            {!customerId && customerName.trim() && (
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={saveCustomer}
                  onChange={e => setSaveCustomer(e.target.checked)}
                />
                Save to customer list
              </label>
            )}
          </div>
        </div>
      </div>

      {/* ── Description ──────────────────────────────────────── */}
      <div className="inv-section">
        <h3 className="inv-section-title">DESCRIPTION</h3>
        <textarea
          id="inv-description"
          className="mono-textarea"
          rows={3}
          placeholder={typeDefaults.description || 'Notes shown on the document'}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      {/* ── Items ────────────────────────────────────────────── */}
      <div className="inv-section">
        <div className="item-list-shell">
          <ItemList
            items={items}
            itemPlaceholder={typeDefaults.itemPlaceholder}
            onAdd={handleAddItem}
            onRemove={handleRemoveItem}
            onChange={handleItemChange}
          />
        </div>
      </div>

      {/* ── Summary ──────────────────────────────────────────── */}
      <div className="inv-summary">
        <div className="inv-summary-line">
          <span>Sub Total</span>
          <span>{formatRM(subtotal)}</span>
        </div>
        <div className="inv-summary-line">
          <span>Discount</span>
          <input
            id="inv-discount"
            type="number"
            min={0}
            max={subtotal}
            step={0.01}
            className="discount-input"
            value={discount === 0 ? '' : discount}
            placeholder="0"
            onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
          />
        </div>
        <div className="inv-total-row">
          <span>TOTAL</span>
          <span>{formatRM(finalTotal)}</span>
        </div>
      </div>

      {/* ── Action ───────────────────────────────────────────── */}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="inv-action inv-action--split">
        <button
          id="inv-save-only"
          type="button"
          className="btn btn--ghost btn--lg"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Save Record'}
        </button>
        <button
          id="inv-download-only"
          type="button"
          className="btn btn--primary btn--lg"
          onClick={handleDownload}
        >
          ⬇ Download PDF
        </button>
      </div>
    </div>
  );
}
