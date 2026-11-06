import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="status-page">
      <div className="status-page-card">
        <div className="status-page-code">404</div>
        <h1>Page not found</h1>
        <p>The page you&apos;re looking for doesn&apos;t exist or may have been deleted.</p>
        <div className="flex gap-2 status-page-actions">
          <Link href="/dashboard" className="btn btn--primary">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
