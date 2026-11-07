import { NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/cronAuth';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const DEFAULT_RECIPIENT = 'trucode.company@gmail.com';

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET is not configured' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request, cronSecret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const to = new URL(request.url).searchParams.get('to') || DEFAULT_RECIPIENT;

  const result = await sendEmail({
    to,
    subject: 'InvoiceMudah test email',
    text: 'Congrats! InvoiceMudah can now send email from your Gmail account.',
  });

  return NextResponse.json({ ...result, to }, { status: result.ok ? 200 : 502 });
}
