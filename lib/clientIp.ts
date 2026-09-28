/**
 * Client IP of a request that came through the reverse proxy (nginx). Works in middleware (Edge)
 * and in route handlers.
 *
 * TRUST_PROXY = how many proxies sit in front of the app (default 1): the client is that many
 * entries from the right of X-Forwarded-For — the part the proxies themselves appended, which a
 * client cannot forge. Returns '' when there are no proxy headers (e.g. a direct call from the
 * Fayda backend on the same server).
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const chain = forwarded.split(',').map(s => s.trim()).filter(Boolean);
    const hops = Math.max(1, Number(process.env.TRUST_PROXY) || 1);
    return chain[Math.max(0, chain.length - hops)] || '';
  }
  return request.headers.get('x-real-ip')?.trim() || '';
}
