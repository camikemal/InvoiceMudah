import type { SupabaseClient } from '@supabase/supabase-js';
import type { Invoice, InvoiceItem } from '@/types/invoice';

interface DbError {
  code?: string;
  message?: string;
}

/** Turn Postgres / PostgREST errors into messages a user can act on */
export function friendlyDbError(err: unknown): string {
  const e = (err ?? {}) as DbError;
  if (e.code === '23505') {
    return 'This invoice number is already used. Change the running number and try again.';
  }
  if (e.code === '42501') return 'Your session has expired. Please sign in again.';
  if (e.code === 'PGRST202') {
    return 'Database is not up to date. Run the latest Supabase migrations (supabase db push).';
  }
  if (e.message) return e.message;
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

interface InvoiceItemRow {
  id: string;
  item_name: string;
  quantity: number | string;
  price: number | string;
  total: number | string;
}

/** Load one invoice with its items (numeric columns come back as strings) */
export async function fetchInvoiceWithItems(
  supabase: SupabaseClient,
  id: string,
): Promise<Invoice | null> {
  const [{ data: inv }, { data: items }] = await Promise.all([
    supabase.from('invoices').select('*').eq('id', id).single(),
    supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', id)
      .order('sort_order', { ascending: true }),
  ]);
  if (!inv) return null;

  return {
    ...inv,
    subtotal: Number(inv.subtotal),
    discount: Number(inv.discount),
    total: Number(inv.total),
    amount_paid: Number(inv.amount_paid ?? 0),
    items: ((items ?? []) as InvoiceItemRow[]).map(it => ({
      id: it.id,
      item_name: it.item_name,
      quantity: Number(it.quantity),
      price: Number(it.price),
      total: Number(it.total),
    })),
  } as Invoice;
}

/**
 * Create (no id) or update (with id) an invoice and its items atomically.
 * Pass runningNumber for new invoices so the user's counter advances.
 */
export async function saveInvoice(
  supabase: SupabaseClient,
  invoice: Invoice,
  runningNumber?: number | null,
): Promise<string> {
  const { items, ...header } = invoice;
  const { data, error } = await supabase.rpc('save_invoice', {
    p_invoice: header,
    p_items: items.map((it: InvoiceItem) => ({
      item_name: it.item_name,
      quantity: it.quantity,
      price: it.price,
    })),
    p_running_number: runningNumber ?? null,
  });
  if (error) throw error;
  return data as string;
}

/** Next running number from the server, falling back to user_settings */
export async function fetchNextRunningNumber(supabase: SupabaseClient): Promise<number | null> {
  const { data, error } = await supabase.rpc('next_invoice_number');
  if (error || typeof data !== 'number') return null;
  return data;
}
