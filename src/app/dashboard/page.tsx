import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import SignOutButton from './SignOutButton';
import MonthlyChart from '@/components/MonthlyChart';
import { computeTotals, currentMonthKey, monthlyBilled, SUMMARY_COLUMNS, type InvoiceSummary } from '@/lib/stats';
import { formatRM } from '@/types/invoice';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: businesses }, { data: invoiceRows }] = await Promise.all([
    supabase
      .from('businesses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('invoices')
      .select(SUMMARY_COLUMNS)
      .eq('user_id', user.id),
  ]);

  const invoices = (invoiceRows ?? []) as InvoiceSummary[];
  const monthKey = currentMonthKey();
  const overall = computeTotals(invoices);
  const thisMonth = computeTotals(invoices.filter(i => i.invoice_date.startsWith(monthKey)));
  const chart = monthlyBilled(invoices, 12);
  const yearTotal = chart.reduce((s, m) => s + m.total, 0);

  const perBusiness = new Map<string, ReturnType<typeof computeTotals> & { month: number }>();
  for (const biz of businesses ?? []) {
    const own = invoices.filter(i => i.business_id === biz.id);
    perBusiness.set(biz.id, {
      ...computeTotals(own),
      month: computeTotals(own.filter(i => i.invoice_date.startsWith(monthKey))).billed,
    });
  }

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
          <SignOutButton email={user.email} name={user.user_metadata?.full_name} />
        </div>
      </header>

      <main className="app-main">
        {invoices.length > 0 && (
          <>
            <div className="page-heading">
              <h1>Overview</h1>
              <p className="page-sub">Across all your businesses.</p>
            </div>

            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-label">Billed this month</span>
                <span className="stat-value">{formatRM(thisMonth.billed)}</span>
                <span className="stat-sub">Collected {formatRM(thisMonth.collected)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Outstanding</span>
                <span className="stat-value">{formatRM(overall.outstanding)}</span>
                <span className="stat-sub">Unpaid &amp; partial invoices</span>
              </div>
              <div className={`stat-card${overall.overdueCount ? ' stat-card--alert' : ''}`}>
                <span className="stat-label">Overdue</span>
                <span className="stat-value">{overall.overdueCount}</span>
                <span className="stat-sub">{formatRM(overall.overdueAmount)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Last 12 months</span>
                <span className="stat-value">{formatRM(yearTotal)}</span>
                <span className="stat-sub">Billed</span>
              </div>
            </div>

            <section className="chart-card">
              <div className="section-heading">
                <h2>Monthly billed</h2>
                <span className="section-count">Last 12 months · RM</span>
              </div>
              <MonthlyChart data={chart} />
            </section>
          </>
        )}

        <div className="page-heading">
          <h1>My Businesses</h1>
          <p className="page-sub">Select a business to view invoices or create a new one.</p>
        </div>

        <div className="biz-grid">
          {/* Existing businesses */}
          {(businesses ?? []).map(biz => {
            const s = perBusiness.get(biz.id);
            return (
              <Link key={biz.id} href={`/business/${biz.id}`} className="biz-card">
                <div className="biz-card-name">{biz.name}</div>
                <div className="biz-card-detail">{biz.location || '—'}</div>
                <div className="biz-card-detail">{biz.phone || '—'}</div>
                {s && (s.billed > 0 || s.outstanding > 0) && (
                  <div className="biz-card-stats">
                    <span>This month <strong>{formatRM(s.month)}</strong></span>
                    <span className={s.overdueCount ? 'biz-card-stat--alert' : undefined}>
                      Outstanding <strong>{formatRM(s.outstanding)}</strong>
                    </span>
                  </div>
                )}
                <span className="biz-card-arrow">View →</span>
              </Link>
            );
          })}

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
