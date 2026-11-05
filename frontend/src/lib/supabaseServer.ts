/**
 * Minimal server-only Supabase client over REST.
 *
 * The site's own server talks to Supabase with the service-role key, which
 * must never reach the browser: only import this from route handlers and
 * server components. Works with both key formats Supabase issues (legacy
 * JWTs and the newer sb_secret_ keys).
 */

const URL_DEFAULT = "https://gdfhdcjfnrbbtwsfoxea.supabase.co";

export class NotConfiguredError extends Error {
  constructor(what: string) {
    super(`${what} is not configured on the server`);
    this.name = "NotConfiguredError";
  }
}

export function supabaseUrl(): string {
  return (process.env.SUPABASE_URL || URL_DEFAULT).replace(/\/$/, "");
}

function serviceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new NotConfiguredError("SUPABASE_SERVICE_ROLE_KEY");
  return key.trim();
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = serviceKey();
  const h: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
    ...extra,
  };
  // Legacy keys are JWTs and go in Authorization too; new secret keys must not.
  if (key.startsWith("eyJ")) h.Authorization = `Bearer ${key}`;
  return h;
}

async function check(res: Response, what: string): Promise<Response> {
  if (res.ok) return res;
  const body = await res.text().catch(() => "");
  throw new Error(`${what} failed (${res.status}): ${body.slice(0, 300)}`);
}

/** Call a Postgres function exposed by PostgREST. */
export async function rpc<T>(fn: string, args: Record<string, unknown>, timeoutMs = 15_000): Promise<T> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  await check(res, `rpc ${fn}`);
  return (await res.json()) as T;
}

/** Table access, e.g. rest("alerts?select=id&active=eq.true"). */
export async function rest<T>(
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<T> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers: headers(init.prefer ? { Prefer: init.prefer } : {}),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  await check(res, `${init.method ?? "GET"} ${path.split("?")[0]}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Invoke an Edge Function. */
export async function invokeFunction<T>(name: string, body: unknown, timeoutMs = 30_000): Promise<T> {
  const res = await fetch(`${supabaseUrl()}/functions/v1/${name}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  await check(res, `function ${name}`);
  return (await res.json()) as T;
}
