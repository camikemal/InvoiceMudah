import { displayStatus, outstandingAmount, type DocumentType, type InvoiceStatus } from '@/types/invoice';

/** Minimal invoice shape needed for listing, filtering and totals */
export interface InvoiceSummary {
  id: string;
  business_id?: string | null;
  invoice_number: string;
  invoice_date: string;
  document_type: DocumentType;
  customer_id?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  subtotal?: number | string;
  discount?: number | string;
  total: number | string;
  status?: InvoiceStatus | null;
  due_date?: string | null;
  paid_at?: string | null;
  amount_paid?: number | string | null;
  source_invoice_id?: string | null;
}

export const SUMMARY_COLUMNS =
  'id, business_id, invoice_number, invoice_date, document_type, customer_id, customer_name, customer_phone, customer_email, subtotal, discount, total, status, due_date, paid_at, amount_paid, source_invoice_id';

/**
 * A document counts as a sale when it is a non-cancelled invoice, or a
 * receipt that was NOT issued for an existing invoice (to avoid double counting).
 */
export const isSale = (inv: InvoiceSummary): boolean =>
  (inv.document_type === 'INVOICE' && inv.status !== 'CANCELLED') ||
  (inv.document_type === 'RECEIPT' && !inv.source_invoice_id);

/** Money actually received for a document */
export const collectedAmount = (inv: InvoiceSummary): number => {
  if (inv.document_type === 'RECEIPT') return inv.source_invoice_id ? 0 : Number(inv.total);
  if (inv.document_type === 'INVOICE' && inv.status !== 'CANCELLED') return Number(inv.amount_paid ?? 0);
  return 0;
};

export interface Totals {
  billed: number;
  collected: number;
  outstanding: number;
  overdueCount: number;
  overdueAmount: number;
}

export function computeTotals(invoices: InvoiceSummary[]): Totals {
  const totals: Totals = { billed: 0, collected: 0, outstanding: 0, overdueCount: 0, overdueAmount: 0 };
  for (const inv of invoices) {
    if (isSale(inv)) totals.billed += Number(inv.total);
    totals.collected += collectedAmount(inv);
    const owed = outstandingAmount({ ...inv, total: Number(inv.total), amount_paid: Number(inv.amount_paid ?? 0) });
    totals.outstanding += owed;
    if (displayStatus(inv) === 'OVERDUE') {
      totals.overdueCount += 1;
      totals.overdueAmount += owed;
    }
  }
  return totals;
}

/** Billed amount per month (YYYY-MM) for the last `months` months, oldest first */
export function monthlyBilled(invoices: InvoiceSummary[], months = 12): { key: string; label: string; total: number }[] {
  const now = new Date();
  const buckets: { key: string; label: string; total: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-GB', { month: 'short' }),
      total: 0,
    });
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const inv of invoices) {
    if (!isSale(inv)) continue;
    const i = index.get(inv.invoice_date.slice(0, 7));
    if (i !== undefined) buckets[i].total += Number(inv.total);
  }
  return buckets;
}

export const currentMonthKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
