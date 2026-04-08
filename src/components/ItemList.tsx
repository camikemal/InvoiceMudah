'use client';

/**
 * ItemList Component
 * ─────────────────────────────────────────────────────────────
 * Renders a dynamic list of invoice line item rows.
 * Each row: Item Name | Quantity (Nights) | Price | Total (auto)
 *
 * Parent passes the items array and three callbacks:
 *   onAdd    — append a new empty row
 *   onRemove — remove row by index
 *   onChange — update a field in one row (also recalculates total)
 */

import type { InvoiceItem } from '@/types/invoice';

interface ItemListProps {
  items: InvoiceItem[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, field: keyof InvoiceItem, value: string | number) => void;
}

export default function ItemList({ items, onAdd, onRemove, onChange }: ItemListProps) {
  return (
    <div className="item-list">
      {/* ── Table header ──────────────────────────────────── */}
      <div className="item-table-head">
        <span className="it-col-num">No.</span>
        <span className="it-col-name">ITEM</span>
        <span className="it-col-qty">QTY</span>
        <span className="it-col-price">PRICE (RM)</span>
        <span className="it-col-total">TOTAL</span>
        <span className="it-col-action" />
      </div>

      {/* ── Item rows ─────────────────────────────────────── */}
      {items.map((item, idx) => (
        <div key={item.id} className="item-row">
          {/* Row number */}
          <span className="it-col-num it-num">{idx + 1}.</span>

          {/* Item name */}
          <div className="it-col-name">
            <input
              id={`item-name-${idx}`}
              className="item-input"
              placeholder="e.g. Deluxe Room"
              value={item.item_name}
              onChange={e => onChange(idx, 'item_name', e.target.value)}
            />
          </div>

          {/* Quantity */}
          <div className="it-col-qty">
            <input
              id={`item-qty-${idx}`}
              className="item-input item-input-num"
              type="number"
              min={0}
              step={1}
              value={item.quantity === 0 ? '' : item.quantity}
              placeholder="0"
              onChange={e => onChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Price */}
          <div className="it-col-price">
            <input
              id={`item-price-${idx}`}
              className="item-input item-input-num"
              type="number"
              min={0}
              step={0.01}
              value={item.price === 0 ? '' : item.price}
              placeholder="0"
              onChange={e => onChange(idx, 'price', parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Total (read-only, auto-calculated) */}
          <div className="it-col-total">
            <span className="item-total-value">
              RM {item.total.toFixed(2)}
            </span>
          </div>

          {/* Remove row button */}
          <div className="it-col-action">
            {items.length > 1 && (
              <button
                id={`item-remove-${idx}`}
                type="button"
                className="item-remove-btn"
                onClick={() => onRemove(idx)}
                title="Remove item"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      ))}

      {/* ── Add row button ────────────────────────────────── */}
      <button
        id="add-item-btn"
        type="button"
        className="add-item-btn"
        onClick={onAdd}
      >
        + Add Item
      </button>
    </div>
  );
}
