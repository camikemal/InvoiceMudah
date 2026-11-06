'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="status-page">
      <div className="status-page-card">
        <div className="status-page-code">Oops</div>
        <h1>Something went wrong</h1>
        <p>
          We couldn&apos;t load this page. Check your connection and try again.
          {error.digest && <span className="status-page-digest">Ref: {error.digest}</span>}
        </p>
        <div className="flex gap-2 status-page-actions">
          <button type="button" className="btn btn--primary" onClick={() => unstable_retry()}>
            Try again
          </button>
          <Link href="/dashboard" className="btn btn--ghost">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
