import { timingSafeEqual } from 'node:crypto';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Accepts `Authorization: Bearer <secret>` (Vercel Cron) or `?secret=<secret>` */
export function isAuthorized(request: Request, cronSecret: string): boolean {
  const header = request.headers.get('authorization');
  if (header && safeEqual(header, `Bearer ${cronSecret}`)) return true;
  const param = new URL(request.url).searchParams.get('secret');
  return param !== null && safeEqual(param, cronSecret);
}
