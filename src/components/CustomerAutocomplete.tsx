'use client';

/**
 * CustomerAutocomplete
 * Text input for the customer name that suggests saved customers of the
 * business. Typing a new name simply unlinks any previously selected customer.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Customer } from '@/types/invoice';

interface CustomerAutocompleteProps {
  businessId: string;
  value: string;
  selectedId: string | null;
  onChangeName: (name: string) => void;
  onSelect: (customer: Customer) => void;
}

export default function CustomerAutocomplete({
  businessId,
  value,
  selectedId,
  onChangeName,
  onSelect,
}: CustomerAutocompleteProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('customers')
      .select('id, business_id, name, phone, email, notes')
      .eq('business_id', businessId)
      .order('name', { ascending: true })
      .then(({ data }) => setCustomers((data ?? []) as Customer[]));
  }, [businessId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q
      ? customers.filter(
          c =>
            c.name.toLowerCase().includes(q) ||
            (c.phone ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, '') || '\u0000'),
        )
      : customers;
    return list.slice(0, 8);
  }, [customers, value]);

  const choose = (c: Customer) => {
    onSelect(c);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => (h + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => (h - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(matches[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="autocomplete" ref={wrapRef}>
      <input
        id="inv-customer-name"
        placeholder={customers.length ? 'Type to search saved customers…' : 'e.g. Akmal Hakim'}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls="customer-suggestions"
        onFocus={() => setOpen(true)}
        onChange={e => {
          onChangeName(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {selectedId && <span className="autocomplete-linked">Saved customer</span>}
      {open && matches.length > 0 && (
        <ul className="autocomplete-list" id="customer-suggestions" role="listbox">
          {matches.map((c, idx) => (
            <li
              key={c.id}
              role="option"
              aria-selected={idx === highlight}
              className={`autocomplete-item${idx === highlight ? ' autocomplete-item--active' : ''}`}
              onMouseDown={e => {
                e.preventDefault();
                choose(c);
              }}
              onMouseEnter={() => setHighlight(idx)}
            >
              <span className="autocomplete-name">{c.name}</span>
              <span className="autocomplete-meta">{[c.phone, c.email].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
