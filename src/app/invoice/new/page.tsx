import { Suspense } from 'react';
import InvoiceNewContent from './InvoiceNewContent';

/**
 * /invoice/new — wrapper page with Suspense boundary
 * (required when using useSearchParams inside a child component)
 */
export default function InvoiceNewPage() {
  return (
    <Suspense fallback={<div className="page-loading"><div className="spinner" />Loading…</div>}>
      <InvoiceNewContent />
    </Suspense>
  );
}
