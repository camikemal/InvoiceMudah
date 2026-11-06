import { displayStatus } from '@/types/invoice';
import type { InvoiceSummary } from '@/lib/stats';

function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  // Neutralise spreadsheet formula injection
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const money = (v: number | string | null | undefined) => Number(v ?? 0).toFixed(2);

/** Build and download a CSV of the given invoices */
export function downloadInvoicesCsv(invoices: InvoiceSummary[], filename: string): void {
  const header = [
    'Number', 'Date', 'Type', 'Status', 'Customer', 'Phone', 'Email',
    'Sub Total (RM)', 'Discount (RM)', 'Total (RM)', 'Paid (RM)', 'Paid On', 'Due Date',
  ];
  const rows = invoices.map(inv => [
    inv.invoice_number,
    inv.invoice_date,
    inv.document_type,
    displayStatus(inv),
    inv.customer_name,
    inv.customer_phone,
    inv.customer_email,
    money(inv.subtotal),
    money(inv.discount),
    money(inv.total),
    money(inv.document_type === 'RECEIPT' ? inv.total : inv.amount_paid),
    inv.paid_at,
    inv.due_date,
  ]);

  const csv = [header, ...rows].map(r => r.map(escapeCell).join(',')).join('\r\n');
  // BOM so Excel opens UTF-8 correctly
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
