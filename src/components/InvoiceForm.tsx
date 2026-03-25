'use client';

/**
 * InvoiceForm Component — Phase 2
 * ─────────────────────────────────────────────────────────────
 * Features:
 *  • Document type picker: INVOICE / RECEIPT / QUOTATION
 *  • Running number input (user sets current → next = current+1)
 *  • Invoice number format: INV_{BIZNAME}_{N}
 *  • Download PDF = auto-save (one action)
 *  • After download+save: shows "Back to Business →" button
 */

import { useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import ItemList from '@/components/ItemList';
import { generatePDF } from '@/lib/generatePDF';
import type { Business, Invoice, InvoiceItem, UserSettings } from '@/types/invoice';
import { emptyItem, formatInvoiceNumber, type DocumentType } from '@/types/invoice';

const DOC_TYPES: DocumentType[] = ['INVOICE', 'RECEIPT', 'QUOTATION'];

interface InvoiceFormProps {
  business: Business;
  userId: string;
  userSettings: UserSettings;
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
  onDone,
}: InvoiceFormProps) {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];

  // ── Document type ─────────────────────────────────────────────
  const [docType, setDocType] = useState<DocumentType>('RECEIPT');

  // ── Running number ────────────────────────────────────────────
  // currentNumber = the LAST used number (from user_settings)
  // nextNumber    = currentNumber + 1 (this is what we'll assign)
  const [currentNumber, setCurrentNumber] = useState(userSettings.last_invoice_number);
  const nextNumber    = currentNumber + 1;
  const invoiceNumber = formatInvoiceNumber(business.name, nextNumber);

  // ── Customer details ──────────────────────────────────────────
  const [customerName,  setCustomerName]  = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [description,   setDescription]  = useState('');

  // ── Line items ────────────────────────────────────────────────
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);

  // ── Discount ──────────────────────────────────────────────────
  const [discount, setDiscount] = useState(0);

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
            updated.total = Number(updated.quantity) * Number(updated.price);
          }
          return updated;
        })
      );
    },
    []
  );

  // ── Build invoice object ──────────────────────────────────────
  const buildInvoice = (): Invoice => ({
    user_id:       userId,
    business_id:   business.id,
    invoice_number: invoiceNumber,
    invoice_date:  today,
    document_type: docType,
    customer_name: customerName,
    customer_phone: customerPhone,
    description,
    items,
    subtotal,
    discount,
    total: finalTotal,
  });

  // ── Download PDF + Auto-Save ──────────────────────────────────
  const handleDownloadAndSave = async () => {
    if (!customerName.trim()) {
      setError('Please enter a customer name.');
      return;
    }
    setError('');

    const invoice = buildInvoice();

    // 1. Generate + download the PDF immediately (browser action)
    generatePDF(invoice, business);

    // 2. Save to Supabase
    setSaving(true);
    try {
      // Insert invoice header
      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .insert({
          user_id:        userId,
          business_id:    invoice.business_id,
          invoice_number: invoice.invoice_number,
          customer_name:  invoice.customer_name,
          customer_phone: invoice.customer_phone,
          description:    invoice.description,
          discount:       invoice.discount,
          subtotal:       invoice.subtotal,
          total:          invoice.total,
          invoice_date:   invoice.invoice_date,
          document_type:  invoice.document_type,
        })
        .select()
        .single();

      if (invErr) throw invErr;

      // Insert line items
      const itemRows = invoice.items.map((item, idx) => ({
        invoice_id: inv.id,
        item_name:  item.item_name,
        quantity:   item.quantity,
        price:      item.price,
        total:      item.total,
        sort_order: idx,
      }));
      const { error: itemsErr } = await supabase
        .from('invoice_items')
        .insert(itemRows);
      if (itemsErr) throw itemsErr;

      // Update (or insert) user running number
      await supabase
        .from('user_settings')
        .upsert({ user_id: userId, last_invoice_number: nextNumber }, { onConflict: 'user_id' });

      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed. Check console.');
    } finally {
      setSaving(false);
    }
  };

  // ── Post-save state ───────────────────────────────────────────
  if (saved) {
    return (
      <div className="invoice-saved-screen">
        <div className="invoice-saved-icon">✓</div>
        <h2>Invoice Downloaded &amp; Saved</h2>
        <p className="invoice-saved-num">{invoiceNumber}</p>
        <p className="invoice-saved-sub">
          The PDF was downloaded and the record is saved to your account.
        </p>
        <button className="btn btn--primary" onClick={onDone}>
          ← Back to {business.name}
        </button>
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
                onClick={() => setDocType(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="inv-header-meta">INVOICE NUMBER: {invoiceNumber}</div>
          <div className="inv-header-meta">DATE: {formatDisplayDate(today)}</div>
        </div>
        <div className="inv-header-right">
          <div className="inv-biz-name">{business.name}</div>
          <div className="inv-biz-meta">{business.location}</div>
          <div className="inv-biz-meta">{business.phone}</div>
        </div>
      </div>

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
              onChange={e => setCurrentNumber(parseInt(e.target.value) || 0)}
            />
            <span className="running-preview">→ {invoiceNumber}</span>
          </div>
        </div>
      </div>

      {/* ── Bill To ──────────────────────────────────────────── */}
      <div className="inv-section">
        <h3 className="inv-section-title">BILL TO</h3>
        <div className="inv-row-2">
          <div className="form-field">
            <label>Customer Name *</label>
            <input
              id="inv-customer-name"
              placeholder="e.g. Khass Event Management Sdn Bhd"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Customer Phone</label>
            <input
              id="inv-customer-phone"
              placeholder="e.g. 011-21551660"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
            />
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
          placeholder={`Check in  : 23 March 2026\nCheck out : 24 March 2026`}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      {/* ── Items ────────────────────────────────────────────── */}
      <div className="inv-section">
        <ItemList
          items={items}
          onAdd={handleAddItem}
          onRemove={handleRemoveItem}
          onChange={handleItemChange}
        />
      </div>

      {/* ── Summary ──────────────────────────────────────────── */}
      <div className="inv-summary">
        <div className="inv-summary-line">
          <span>Sub Total</span>
          <span>RM {subtotal.toFixed(2)}</span>
        </div>
        <div className="inv-summary-line">
          <span>Discount</span>
          <input
            id="inv-discount"
            type="number"
            min={0}
            step={0.01}
            className="discount-input"
            value={discount === 0 ? '' : discount}
            placeholder="0"
            onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="inv-total-row">
          <span>TOTAL</span>
          <span>RM {finalTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* ── Action ───────────────────────────────────────────── */}
      {error && <p className="form-error">{error}</p>}

      <div className="inv-action">
        <button
          id="inv-download-save"
          type="button"
          className="btn btn--primary btn--lg"
          onClick={handleDownloadAndSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : '⬇ Download PDF & Save'}
        </button>
      </div>
    </div>
  );
}
