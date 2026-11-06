import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
}

/** Accepts `Authorization: Bearer <secret>` (Vercel Cron) or `?secret=<secret>` */
function isAuthorized(request: Request, cronSecret: string): boolean {
  const header = request.headers.get('authorization');
  if (header === `Bearer ${cronSecret}`) return true;
  return new URL(request.url).searchParams.get('secret') === cronSecret;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET is not configured' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request, cronSecret)) return unauthorized();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { ok: false, error: 'Supabase is not configured' },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const startedAt = Date.now();

  const { error } = await supabase.from('profiles').select('id').limit(1);
  const latencyMs = Date.now() - startedAt;

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, latencyMs },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    service: 'invoicemudah',
    database: 'reachable',
    latencyMs,
    timestamp: new Date().toISOString(),
  });
}
