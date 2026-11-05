/** Public origin for links we send out (Telegram messages, webhooks). */
export function siteOrigin(req: Request): string {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : new URL(req.url).origin;
}
