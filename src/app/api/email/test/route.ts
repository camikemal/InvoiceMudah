import { NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/cronAuth';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

/** Test sends only go to the sender's own inbox so a leaked secret can't be used to spam others. */
const TEST_RECIPIENT = process.env.SMTP_USER || 'trucode.company@gmail.com';

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

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

  const result = await sendEmail({
    to: TEST_RECIPIENT,
    subject: 'InvoiceMudah test email',
    text: 'Congrats! InvoiceMudah can now send email from your Gmail account.',
  });

  return NextResponse.json({ ...result, to: TEST_RECIPIENT }, { status: result.ok ? 200 : 502 });
}
