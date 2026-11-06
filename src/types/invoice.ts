// ─── Invoice Types ────────────────────────────────────────────────────────────

/** Document type displayed in the top-left of the PDF header */
export type DocumentType = 'INVOICE' | 'RECEIPT' | 'QUOTATION';

/** Payment status stored on the invoice row */
export type InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'CANCELLED';

/** Status shown in the UI — OVERDUE is derived, never stored */
export type DisplayStatus = InvoiceStatus | 'OVERDUE';

export type BusinessType = 'HOMESTAY' | 'RETAIL' | 'SERVICE' | 'FOOD' | 'OTHER';

/** One line item on the invoice */
export interface InvoiceItem {
  id: string;           // local unique id (for React keys & removal)
  item_name: string;
  quantity: number;
  price: number;
  total: number;        // quantity × price (auto-calculated)
}

/** Business profile — one user can have many businesses */
export interface Business {
  id?: string;
  user_id?: string;
  name: string;
  location: string;
  phone: string;
  bank: string;
  account_name: string;
  account_number: string;
  terms: string;
  business_type?: BusinessType;
  default_description?: string | null;
  default_due_days?: number;
}

/** Saved customer belonging to a business */
export interface Customer {
  id: string;
  user_id?: string;
  business_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

/** Full invoice (header + items) */
export interface Invoice {
  id?: string;
  user_id?: string;
  business_id?: string;
  invoice_number: string;
  invoice_date: string;     // YYYY-MM-DD
  document_type: DocumentType;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;  // Optional customer email
  description: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  status?: InvoiceStatus;
  due_date?: string | null;        // YYYY-MM-DD
  paid_at?: string | null;         // YYYY-MM-DD
  amount_paid?: number;
  source_invoice_id?: string | null;
}

/** Per-user settings (running invoice counter) */
export interface UserSettings {
  user_id: string;
  last_invoice_number: number;
}

/** Empty default item row */
export const emptyItem = (): InvoiceItem => ({
  id: crypto.randomUUID(),
  item_name: '',
  quantity: 1,
  price: 0,
  total: 0,
});

/** Slugify business name for invoice number: "ADIA HOMESTAY" → "ADIAHOMESTAY" */
export const bizSlug = (name: string): string =>
  name.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '');

/** Format document number: INVOICE 1046 - ADIA HOMESTAY, RCP 1047 - BILIK RIZQI, etc. */
export const formatInvoiceNumber = (type: DocumentType, bizName: string, n: number): string => {
  return `${type} ${n} - ${bizName}`;
};

/** Extract the running number from "TYPE N - BIZ" or legacy "PREFIX_BIZ_N" */
export const parseRunningNumber = (invoiceNumber: string): number | null => {
  const matchNew = invoiceNumber.match(/^(?:INVOICE|RECEIPT|QUOTATION)\s+(\d+)\s+-/i);
  if (matchNew) return parseInt(matchNew[1]);
  const parts = invoiceNumber.split('_');
  const lastPart = parseInt(parts[parts.length - 1]);
  return isNaN(lastPart) ? null : lastPart;
};

/** Today's date as YYYY-MM-DD in local time */
export const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const addDaysISO = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const defaultStatusFor = (type: DocumentType): InvoiceStatus =>
  type === 'RECEIPT' ? 'PAID' : type === 'QUOTATION' ? 'DRAFT' : 'UNPAID';

/** Effective status for display: unpaid/partial invoices past their due date are OVERDUE */
export const displayStatus = (inv: {
  status?: InvoiceStatus | null;
  due_date?: string | null;
  document_type: DocumentType | string;
}): DisplayStatus => {
  const status = inv.status ?? defaultStatusFor(inv.document_type as DocumentType);
  if (
    inv.document_type === 'INVOICE' &&
    (status === 'UNPAID' || status === 'PARTIAL') &&
    inv.due_date &&
    inv.due_date < todayISO()
  ) {
    return 'OVERDUE';
  }
  return status;
};

/** Amount still owed on an invoice */
export const outstandingAmount = (inv: {
  status?: InvoiceStatus | null;
  total: number;
  amount_paid?: number | null;
  document_type: DocumentType | string;
}): number => {
  if (inv.document_type !== 'INVOICE') return 0;
  if (inv.status === 'PAID' || inv.status === 'CANCELLED' || inv.status === 'DRAFT') return 0;
  return Math.max(0, Number(inv.total) - Number(inv.amount_paid ?? 0));
};

export const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: 'HOMESTAY', label: 'Homestay / Rental' },
  { value: 'RETAIL',   label: 'Retail / Shop' },
  { value: 'SERVICE',  label: 'Service' },
  { value: 'FOOD',     label: 'Food & Catering' },
  { value: 'OTHER',    label: 'Other' },
];

/** Suggested defaults when a business type is chosen */
export const BUSINESS_TYPE_DEFAULTS: Record<BusinessType, { description: string; terms: string; itemPlaceholder: string }> = {
  HOMESTAY: {
    description: 'Check in  :\nCheck out :',
    terms: 'Payment is due before the check-in date.',
    itemPlaceholder: 'e.g. Deluxe Room',
  },
  RETAIL: {
    description: '',
    terms: 'Goods sold are not returnable. Payment due within 7 days.',
    itemPlaceholder: 'e.g. Product name',
  },
  SERVICE: {
    description: 'Service period :\nReference      :',
    terms: 'Payment due within 14 days of invoice date.',
    itemPlaceholder: 'e.g. Consultation (hours)',
  },
  FOOD: {
    description: 'Event date :\nVenue      :',
    terms: '50% deposit required to confirm the order. Balance due on delivery.',
    itemPlaceholder: 'e.g. Nasi lemak (pax)',
  },
  OTHER: {
    description: '',
    terms: 'Payment due within 7 days.',
    itemPlaceholder: 'e.g. Item',
  },
};

export const formatRM = (val: number | string | null | undefined): string =>
  `RM ${Number(val ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
