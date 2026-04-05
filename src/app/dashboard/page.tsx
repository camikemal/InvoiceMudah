import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import SignOutButton from './SignOutButton';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Load all businesses for this user
  const { data: businesses } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header-left">
          <Link href="/dashboard" className="app-logo flex items-center gap-2">
            <Image src="/logo.jpeg" alt="Invoice Mudah" width={24} height={24} className="rounded-sm object-contain" />
            <span>Invoice Mudah</span>
          </Link>
        </div>
        <div className="app-header-actions app-header-right">
          <span className="app-header-title">Dashboard</span>
          <SignOutButton email={user.email} />
        </div>
      </header>

      <main className="app-main">
        <div className="page-heading">
          <h1>My Businesses</h1>
          <p className="page-sub">Select a business to view invoices or create a new one.</p>
        </div>

        <div className="biz-grid">
          {/* Existing businesses */}
          {(businesses ?? []).map(biz => (
            <Link key={biz.id} href={`/business/${biz.id}`} className="biz-card">
              <div className="biz-card-name">{biz.name}</div>
              <div className="biz-card-detail">{biz.location || '—'}</div>
              <div className="biz-card-detail">{biz.phone || '—'}</div>
              <span className="biz-card-arrow">View →</span>
            </Link>
          ))}

          {/* Add new business */}
          <Link href="/business/new" className="biz-card biz-card--new">
            <div className="biz-card-plus">+</div>
            <div className="biz-card-name">Add Business</div>
          </Link>
        </div>
      </main>
    </div>
  );
}
