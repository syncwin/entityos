// Bearer-token auth. Fails closed: a missing or weak secret rejects every request.
export const MIN_SECRET_LENGTH = 32;

const enc = new TextEncoder();

export function secretOk(secret: unknown): secret is string {
  return typeof secret === "string" && secret.length >= MIN_SECRET_LENGTH;
}

async function digest(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

/** Constant-time compare: both sides are hashed to equal length, then XOR-folded. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= da[i] ^ db[i];
  return diff === 0;
}

export async function isAuthorized(authHeader: string | null, secret: unknown): Promise<boolean> {
  if (!secretOk(secret)) return false;
  const m = /^Bearer ([^\s]+)$/.exec(authHeader ?? "");
  if (!m) return false;
  return safeEqual(m[1], secret);
}
