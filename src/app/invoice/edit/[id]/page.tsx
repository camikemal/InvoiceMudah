import { Suspense } from 'react';
import InvoiceEditContent from './InvoiceEditContent';

/**
 * /invoice/edit/[id] — wrapper page with Suspense boundary
 */
export default function InvoiceEditPage() {
  return (
    <Suspense fallback={<div className="page-loading"><div className="spinner" />Loading…</div>}>
      <InvoiceEditContent />
    </Suspense>
  );
}
