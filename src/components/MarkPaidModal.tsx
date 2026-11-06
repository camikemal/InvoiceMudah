'use client';

/**
 * MarkPaidModal
 * Records a (full or partial) payment against an invoice, or reverts a paid
 * invoice back to unpaid.
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { friendlyDbError } from '@/lib/invoices';
import { firstError, paymentSchema } from '@/lib/validation';
import { formatRM, todayISO, type InvoiceStatus } from '@/types/invoice';
import type { InvoiceSummary } from '@/lib/stats';

interface MarkPaidModalProps {
  invoice: InvoiceSummary;
  onClose: () => void;
  onUpdated: (patch: Partial<InvoiceSummary>) => void;
}

export default function MarkPaidModal({ invoice, onClose, onUpdated }: MarkPaidModalProps) {
  const supabase = createClient();
  const total = Number(invoice.total);
  const alreadyPaid = Number(invoice.amount_paid ?? 0);
  const remaining = Math.max(0, Math.round((total - alreadyPaid) * 100) / 100);
  const isPaid = invoice.status === 'PAID';

  const [amount, setAmount] = useState(remaining);
  const [paidAt, setPaidAt] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = async (patch: { status: InvoiceStatus; amount_paid: number; paid_at: string | null }) => {
    setSaving(true);
    setError('');
    const { error: dbErr } = await supabase.from('invoices').update(patch).eq('id', invoice.id);
    setSaving(false);
    if (dbErr) {
      setError(friendlyDbError(dbErr));
      return;
    }
    onUpdated(patch);
  };

  const handleRecord = () => {
    const err = firstError(paymentSchema, { amount, paid_at: paidAt });
    if (err) { setError(err); return; }
    if (amount > remaining + 0.001) { setError(`Amount cannot be more than ${formatRM(remaining)}.`); return; }
    const newPaid = Math.round((alreadyPaid + amount) * 100) / 100;
    update({
      status: newPaid >= total ? 'PAID' : 'PARTIAL',
      amount_paid: Math.min(newPaid, total),
      paid_at: paidAt,
    });
  };

  const handleUndo = () => update({ status: 'UNPAID', amount_paid: 0, paid_at: null });

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()} role="presentation">
      <div
        className="modal-content signout-modal-content"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-paid-title"
      >
        <header className="modal-header">
          <h2 id="mark-paid-title">{isPaid ? 'Payment received' : 'Record payment'}</h2>
          <button type="button" className="modal-close" onClick={onClose} disabled={saving} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="signout-modal-body">
          <p className="modal-subtle">
            <strong>{invoice.invoice_number}</strong> · {invoice.customer_name}
          </p>
          <div className="payment-summary">
            <div><span>Total</span><strong>{formatRM(total)}</strong></div>
            <div><span>Paid</span><strong>{formatRM(alreadyPaid)}</strong></div>
            <div><span>Balance</span><strong>{formatRM(remaining)}</strong></div>
          </div>

          {!isPaid && (
            <div className="inv-row-2 payment-fields">
              <div className="form-field">
                <label htmlFor="pay-amount">Amount received (RM)</label>
                <input
                  id="pay-amount"
                  type="number"
                  min={0}
                  step={0.01}
                  max={remaining}
                  value={amount === 0 ? '' : amount}
                  placeholder="0.00"
                  onChange={e => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
              <div className="form-field">
                <label htmlFor="pay-date">Payment date</label>
                <input id="pay-date" type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
              </div>
            </div>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
        </div>

        <footer className="modal-footer signout-modal-footer">
          {isPaid || alreadyPaid > 0 ? (
            <button type="button" className="btn btn--ghost" onClick={handleUndo} disabled={saving}>
              Mark as unpaid
            </button>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
          )}
          {!isPaid && (
            <button type="button" className="btn btn--primary" onClick={handleRecord} disabled={saving}>
              {saving ? 'Saving…' : amount >= remaining ? 'Mark as paid' : 'Record partial payment'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
