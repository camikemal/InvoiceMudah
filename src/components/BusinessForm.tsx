'use client';

/**
 * BusinessForm Component
 * Supports two modes:
 *  - 'create': INSERT a new business (multiple per user allowed)
 *  - 'edit':   UPDATE an existing business by id
 */

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { friendlyDbError } from '@/lib/invoices';
import { businessSchema, firstError } from '@/lib/validation';
import type { Business, BusinessType } from '@/types/invoice';
import { BUSINESS_TYPES, BUSINESS_TYPE_DEFAULTS } from '@/types/invoice';

interface BusinessFormProps {
  initialData?: Business;
  userId: string;
  mode: 'create' | 'edit';
  onSave: (business: Business) => void;
  onCancel?: () => void;
}

const DUE_DAY_OPTIONS = [0, 3, 7, 14, 30];

export default function BusinessForm({
  initialData,
  userId,
  mode,
  onSave,
  onCancel,
}: BusinessFormProps) {
  const initialType: BusinessType = initialData?.business_type ?? 'HOMESTAY';
  const [form, setForm] = useState<Business>({
    name:                initialData?.name           ?? '',
    location:            initialData?.location       ?? '',
    phone:               initialData?.phone          ?? '',
    bank:                initialData?.bank           ?? '',
    account_name:        initialData?.account_name   ?? '',
    account_number:      initialData?.account_number ?? '',
    terms:               initialData?.terms          ?? BUSINESS_TYPE_DEFAULTS[initialType].terms,
    business_type:       initialType,
    default_description: initialData?.default_description ?? BUSINESS_TYPE_DEFAULTS[initialType].description,
    default_due_days:    initialData?.default_due_days ?? 0,
  });

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const supabase = createClient();

  const handleChange = <K extends keyof Business>(field: K, value: Business[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  /** Switching type swaps in that type's suggestions, unless the user customised them */
  const handleTypeChange = (type: BusinessType) => {
    setForm(prev => {
      const oldDefaults = BUSINESS_TYPE_DEFAULTS[prev.business_type ?? 'HOMESTAY'];
      const newDefaults = BUSINESS_TYPE_DEFAULTS[type];
      const untouched = (value: string | null | undefined, oldDefault: string) =>
        !value?.trim() || value.trim() === oldDefault.trim();
      return {
        ...prev,
        business_type: type,
        terms: untouched(prev.terms, oldDefaults.terms) ? newDefaults.terms : prev.terms,
        default_description: untouched(prev.default_description, oldDefaults.description)
          ? newDefaults.description
          : prev.default_description,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = firstError(businessSchema, form);
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    setError('');

    const row = {
      ...form,
      name: form.name.trim(),
      default_description: form.default_description?.trim() ? form.default_description : null,
    };

    try {
      if (mode === 'create') {
        // INSERT — allow multiple businesses per user
        const { data, error: dbErr } = await supabase
          .from('businesses')
          .insert({ ...row, user_id: userId })
          .select()
          .single();
        if (dbErr) throw dbErr;
        onSave(data as Business);
      } else {
        // UPDATE — edit existing business by id
        const { data, error: dbErr } = await supabase
          .from('businesses')
          .update(row)
          .eq('id', initialData!.id!)
          .select()
          .single();
        if (dbErr) throw dbErr;
        onSave(data as Business);
      }
    } catch (err: unknown) {
      setError(friendlyDbError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="biz-form">
      <div className="biz-form-grid">
        <div className="form-field">
          <label htmlFor="biz-name">Business Name *</label>
          <input id="biz-name" placeholder="e.g. Adia Homestay" value={form.name}
            onChange={e => handleChange('name', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="biz-type">Business Type</label>
          <select id="biz-type" value={form.business_type}
            onChange={e => handleTypeChange(e.target.value as BusinessType)}>
            {BUSINESS_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="biz-phone">Phone</label>
          <input id="biz-phone" placeholder="e.g. 012 345 6789" value={form.phone}
            onChange={e => handleChange('phone', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="biz-due-days">Default Payment Due</label>
          <select id="biz-due-days" value={form.default_due_days ?? 0}
            onChange={e => handleChange('default_due_days', parseInt(e.target.value) || 0)}>
            {DUE_DAY_OPTIONS.map(d => (
              <option key={d} value={d}>{d === 0 ? 'No due date' : `${d} days after invoice`}</option>
            ))}
          </select>
        </div>
        <div className="form-field form-field--full">
          <label htmlFor="biz-address">Address</label>
          <textarea id="biz-address" rows={2} placeholder="e.g. No 20, Jalan Pantai timur"
            value={form.location} onChange={e => handleChange('location', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="biz-bank">Bank</label>
          <input id="biz-bank" placeholder="e.g. Maybank" value={form.bank}
            onChange={e => handleChange('bank', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="biz-account-number">Account Number</label>
          <input id="biz-account-number" inputMode="numeric" placeholder="e.g. 16401xxxxxxx" value={form.account_number}
            onChange={e => handleChange('account_number', e.target.value)} />
        </div>
        <div className="form-field form-field--full">
          <label htmlFor="biz-account-name">Account Holder Name</label>
          <input id="biz-account-name" placeholder="e.g. Adia Resources" value={form.account_name}
            onChange={e => handleChange('account_name', e.target.value)} />
        </div>
        <div className="form-field form-field--full">
          <label htmlFor="biz-default-desc">Default Invoice Description</label>
          <textarea id="biz-default-desc" rows={2} className="mono-textarea"
            placeholder="Pre-filled on every new invoice (optional)"
            value={form.default_description ?? ''}
            onChange={e => handleChange('default_description', e.target.value)} />
        </div>
        <div className="form-field form-field--full">
          <label htmlFor="biz-terms">Terms &amp; Conditions</label>
          <textarea id="biz-terms" rows={2} placeholder="e.g. Payment due within 7 days. Non-refundable." value={form.terms}
            onChange={e => handleChange('terms', e.target.value)} />
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

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
