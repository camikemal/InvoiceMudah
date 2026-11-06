'use client';

/**
 * CustomersPanel
 * Saved customers of one business with invoice count and amount billed.
 * Supports add / edit / delete. Invoices keep their own customer snapshot,
 * so deleting a customer never changes existing documents.
 */

import { useEffect, useMemo, useState } from 'react';
import { Edit, Trash2, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/components/Toast';
import Tooltip from '@/components/Tooltip';
import { friendlyDbError } from '@/lib/invoices';
import { customerSchema, firstError } from '@/lib/validation';
import { isSale, type InvoiceSummary } from '@/lib/stats';
import { formatRM, type Customer } from '@/types/invoice';

interface CustomersPanelProps {
  businessId: string;
  userId: string;
  invoices: InvoiceSummary[];
}

type Draft = { id?: string; name: string; phone: string; email: string; notes: string };

const emptyDraft: Draft = { name: '', phone: '', email: '', notes: '' };

export default function CustomersPanel({ businessId, userId, invoices }: CustomersPanelProps) {
  const supabase = createClient();
  const toast = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);

  useEffect(() => {
    supabase
      .from('customers')
      .select('id, business_id, name, phone, email, notes')
      .eq('business_id', businessId)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error(friendlyDbError(error));
        setCustomers((data ?? []) as Customer[]);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  /** Invoice stats per customer — linked by id, falling back to name for older invoices */
  const stats = useMemo(() => {
    const map = new Map<string, { count: number; billed: number; last: string }>();
    const byName = new Map(customers.map(c => [c.name.trim().toLowerCase(), c.id]));
    for (const inv of invoices) {
      const cid = inv.customer_id ?? byName.get(inv.customer_name.trim().toLowerCase());
      if (!cid) continue;
      const s = map.get(cid) ?? { count: 0, billed: 0, last: '' };
      s.count += 1;
      if (isSale(inv)) s.billed += Number(inv.total);
      if (inv.invoice_date > s.last) s.last = inv.invoice_date;
      map.set(cid, s);
    }
    return map;
  }, [customers, invoices]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      [c.name, c.phone, c.email].some(v => (v ?? '').toLowerCase().includes(q)),
    );
  }, [customers, query]);

  const handleSave = async () => {
    if (!draft) return;
    const err = firstError(customerSchema, draft);
    if (err) { setFormError(err); return; }
    setSaving(true);
    setFormError('');

    const row = {
      name: draft.name.trim(),
      phone: draft.phone.trim() || null,
      email: draft.email.trim() || null,
      notes: draft.notes.trim() || null,
    };

    const { data, error } = draft.id
      ? await supabase.from('customers').update(row).eq('id', draft.id).select('id, business_id, name, phone, email, notes').single()
      : await supabase
          .from('customers')
          .insert({ ...row, user_id: userId, business_id: businessId })
          .select('id, business_id, name, phone, email, notes')
          .single();

    setSaving(false);
    if (error) { setFormError(friendlyDbError(error)); return; }

    const saved = data as Customer;
    setCustomers(prev =>
      (draft.id ? prev.map(c => (c.id === saved.id ? saved : c)) : [...prev, saved]).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    toast.success(draft.id ? 'Customer updated' : 'Customer added');
    setDraft(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { error } = await supabase.from('customers').delete().eq('id', pendingDelete.id);
    if (error) {
      toast.error(friendlyDbError(error));
    } else {
      setCustomers(prev => prev.filter(c => c.id !== pendingDelete.id));
      toast.success('Customer deleted');
    }
    setPendingDelete(null);
  };

  return (
    <section className="past-invoices">
      <div className="section-heading">
        <h2>Customers</h2>
        <span className="section-count">{customers.length} saved</span>
      </div>

      <div className="filter-bar">
        <input
          className="filter-search"
          placeholder="Search name, phone or email…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="button" className="btn btn--primary" onClick={() => { setDraft({ ...emptyDraft }); setFormError(''); }}>
          + Add Customer
        </button>
      </div>

      {loading ? (
        <div className="modal-loading"><div className="spinner" />Loading customers…</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <p>{customers.length ? 'No customers match your search.' : 'No saved customers yet. Tick "Save to customer list" when creating an invoice, or add one here.'}</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="inv-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th className="text-right">Documents</th>
                <th className="text-right">Billed</th>
                <th>Last</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(c => {
                const s = stats.get(c.id);
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="cell-strong">{c.name}</div>
                      {c.notes && <div className="cell-sub">{c.notes}</div>}
                    </td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.email || '—'}</td>
                    <td className="text-right">{s?.count ?? 0}</td>
                    <td className="text-right">{formatRM(s?.billed ?? 0)}</td>
                    <td>{s?.last ? new Date(s.last).toLocaleDateString('en-GB') : '—'}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Tooltip label="Edit customer">
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm p-0 w-8 h-8"
                            aria-label="Edit customer"
                            onClick={() => {
                              setDraft({ id: c.id, name: c.name, phone: c.phone ?? '', email: c.email ?? '', notes: c.notes ?? '' });
                              setFormError('');
                            }}
                          >
                            <Edit size={16} />
                          </button>
                        </Tooltip>
                        <Tooltip label="Delete customer">
                          <button
                            type="button"
                            className="btn btn--danger btn--sm p-0 w-8 h-8"
                            aria-label="Delete customer"
                            onClick={() => setPendingDelete(c)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <div className="modal-overlay" onClick={() => !saving && setDraft(null)} role="presentation">
          <div className="modal-content signout-modal-content" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="customer-form-title">
            <header className="modal-header">
              <h2 id="customer-form-title">{draft.id ? 'Edit customer' : 'Add customer'}</h2>
              <button type="button" className="modal-close" onClick={() => setDraft(null)} disabled={saving} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <div className="signout-modal-body">
              <div className="biz-form-grid">
                <div className="form-field form-field--full">
                  <label htmlFor="cust-name">Name *</label>
                  <input id="cust-name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
                </div>
                <div className="form-field">
                  <label htmlFor="cust-phone">Phone</label>
                  <input id="cust-phone" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} />
                </div>
                <div className="form-field">
                  <label htmlFor="cust-email">Email</label>
                  <input id="cust-email" type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} />
                </div>
                <div className="form-field form-field--full">
                  <label htmlFor="cust-notes">Notes</label>
                  <textarea id="cust-notes" rows={2} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
                </div>
              </div>
              {formError && <p className="form-error" role="alert">{formError}</p>}
            </div>
            <footer className="modal-footer signout-modal-footer">
              <button type="button" className="btn btn--ghost" onClick={() => setDraft(null)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn--primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="modal-overlay" onClick={() => setPendingDelete(null)} role="presentation">
          <div className="modal-content signout-modal-content" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="delete-customer-title">
            <header className="modal-header">
              <h2 id="delete-customer-title">Delete customer?</h2>
              <button type="button" className="modal-close" onClick={() => setPendingDelete(null)} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <div className="signout-modal-body">
              <p>
                Delete <strong>{pendingDelete.name}</strong> from your customer list? Existing invoices keep their customer details.
              </p>
            </div>
            <footer className="modal-footer signout-modal-footer">
              <button type="button" className="btn btn--ghost" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button type="button" className="btn btn--danger" onClick={confirmDelete}>Delete Customer</button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
