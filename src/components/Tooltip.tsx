'use client';

/**
 * Tooltip
 * Shows a label above its child on hover / keyboard focus. Rendered in a
 * portal with fixed positioning so it is not clipped by scrollable tables.
 */

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  label: string;
  children: React.ReactElement;
}

export default function Tooltip({ label, children }: TooltipProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);

  const show = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = rect.top < 44;
    setPos({
      x: rect.left + rect.width / 2,
      y: below ? rect.bottom + 8 : rect.top - 8,
      below,
    });
  };
  const hide = () => setPos(null);

  return (
    <span
      ref={wrapRef}
      className="tooltip-anchor"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={hide}
    >
      {children}
      {pos &&
        createPortal(
          <span
            role="tooltip"
            className={`tooltip${pos.below ? ' tooltip--below' : ''}`}
            style={{ left: pos.x, top: pos.y }}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
