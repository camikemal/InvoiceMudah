/** Accepts `Authorization: Bearer <secret>` (Vercel Cron) or `?secret=<secret>` */
export function isAuthorized(request: Request, cronSecret: string): boolean {
  const header = request.headers.get('authorization');
  if (header === `Bearer ${cronSecret}`) return true;
  return new URL(request.url).searchParams.get('secret') === cronSecret;
}
