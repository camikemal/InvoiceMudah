'use client';

/**
 * BusinessForm Component
 * Supports two modes:
 *  - 'create': INSERT a new business (multiple per user allowed)
 *  - 'edit':   UPDATE an existing business by id
 */

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Business } from '@/types/invoice';

interface BusinessFormProps {
  initialData?: Business;
  userId: string;
  mode: 'create' | 'edit';
  onSave: (business: Business) => void;
  onCancel?: () => void;
}

export default function BusinessForm({
  initialData,
  userId,
  mode,
  onSave,
  onCancel,
}: BusinessFormProps) {
  const [form, setForm] = useState<Business>({
    name:           initialData?.name           ?? '',
    location:       initialData?.location       ?? '',
    phone:          initialData?.phone          ?? '',
    bank:           initialData?.bank           ?? '',
    account_name:   initialData?.account_name   ?? '',
    account_number: initialData?.account_number ?? '',
    terms:          initialData?.terms          ?? 'Payment is due before the check-in date.',
  });

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const supabase = createClient();

  const handleChange = (field: keyof Business, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Business name is required.'); return; }
    setLoading(true);
    setError('');

    try {
      if (mode === 'create') {
        // INSERT — allow multiple businesses per user
        const { data, error: dbErr } = await supabase
          .from('businesses')
          .insert({ ...form, user_id: userId })
          .select()
          .single();
        if (dbErr) throw dbErr;
        onSave({ ...form, id: data.id, user_id: userId });
      } else {
        // UPDATE — edit existing business by id
        const { data, error: dbErr } = await supabase
          .from('businesses')
          .update({ ...form })
          .eq('id', initialData!.id!)
          .select()
          .single();
        if (dbErr) throw dbErr;
        onSave({ ...form, id: data.id, user_id: userId });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="biz-form">
      <div className="biz-form-grid">
        <div className="form-field">
          <label>Business Name *</label>
          <input placeholder="e.g. ADIA HOMESTAY" value={form.name}
            onChange={e => handleChange('name', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Phone</label>
          <input placeholder="e.g. 017-230 4353" value={form.phone}
            onChange={e => handleChange('phone', e.target.value)} />
        </div>
        <div className="form-field form-field--full">
          <label>Address</label>
          <textarea rows={2} placeholder="No 20, Jalan W/M 3/8, 35900 Tanjong Malim, Perak"
            value={form.location} onChange={e => handleChange('location', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Bank</label>
          <input placeholder="e.g. MAYBANK" value={form.bank}
            onChange={e => handleChange('bank', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Account Number</label>
          <input placeholder="e.g. 158088006515" value={form.account_number}
            onChange={e => handleChange('account_number', e.target.value)} />
        </div>
        <div className="form-field form-field--full">
          <label>Account Holder Name</label>
          <input placeholder="e.g. SAADIAH BINTI RAPIEI" value={form.account_name}
            onChange={e => handleChange('account_name', e.target.value)} />
        </div>
        <div className="form-field form-field--full">
          <label>Terms &amp; Conditions</label>
          <textarea rows={2} value={form.terms}
            onChange={e => handleChange('terms', e.target.value)} />
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        )}
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Saving…' : mode === 'create' ? 'Create Business' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
