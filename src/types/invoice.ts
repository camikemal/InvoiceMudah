// ─── Invoice Types ────────────────────────────────────────────────────────────

/** Document type displayed in the top-left of the PDF header */
export type DocumentType = 'INVOICE' | 'RECEIPT' | 'QUOTATION';

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
}

/** Full invoice (header + items) */
export interface Invoice {
  id?: string;
  user_id?: string;
  business_id?: string;
  invoice_number: string;
  invoice_date: string;     // YYYY-MM-DD
  document_type: DocumentType;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;  // Optional customer email
  description: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
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
