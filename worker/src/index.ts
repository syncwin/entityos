// EntityOS Worker: read-only MCP endpoint at /mcp. See docs and PRD sections 11-13.
import { isAuthorized, secretOk } from "./auth.ts";
import type { Db } from "./db.ts";
import { handleRpc } from "./mcp.ts";

export interface Env { DB: Db; ENTITYOS_TOKEN?: string }

const MAX_BODY = 16 * 1024;
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
const err = (status: number, error: string, message?: string, headers?: Record<string, string>) =>
  json(message ? { error, message } : { error }, status, headers);

let warned = false;

export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname !== "/mcp") return err(404, "NOT_FOUND");

  // Auth first, before any other detail is revealed. Same 401 for missing, wrong or misconfigured secret.
  if (!secretOk(env.ENTITYOS_TOKEN) && !warned) {
    warned = true;
    console.error("ENTITYOS_TOKEN missing or shorter than 32 characters; rejecting all requests");
  }
  if (!(await isAuthorized(req.headers.get("authorization"), env.ENTITYOS_TOKEN)))
    return err(401, "UNAUTHORIZED", undefined, { "www-authenticate": "Bearer" });

  if (req.method !== "POST") return err(405, "METHOD_NOT_ALLOWED", "Use POST.", { allow: "POST" });
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().startsWith("application/json")) return err(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return err(413, "PAYLOAD_TOO_LARGE");
  const text = await req.text();
  if (text.length > MAX_BODY) return err(413, "PAYLOAD_TOO_LARGE");

  let msg: unknown;
  try {
    msg = JSON.parse(text);
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  const out = await handleRpc(env.DB, msg);
  return out === null ? new Response(null, { status: 202 }) : json(out);
}

export default { fetch: (req: Request, env: Env) => handle(req, env) };
