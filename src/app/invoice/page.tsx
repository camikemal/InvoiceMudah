import { redirect } from 'next/navigation';

/**
 * /invoice — redirect to /dashboard
 * Invoice creation now starts at /business/[id] → /invoice/new?businessId=xxx
 */
export default function InvoicePage() {
  redirect('/dashboard');
}
