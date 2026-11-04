// Minimal stateless MCP over Streamable HTTP (JSON responses, no SSE, no sessions).
import type { Db } from "./db.ts";
import { TOOLS, ToolError } from "./tools.ts";

const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER = { name: "entityos-worker", version: "0.1.0" }; // placeholder name, confirm with owner

type Id = string | number | null;
const rpcError = (id: Id, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
const rpcOk = (id: Id, result: unknown) => ({ jsonrpc: "2.0", id, result });

const toolText = (obj: unknown, isError = false) => ({ content: [{ type: "text", text: JSON.stringify(obj) }], isError });

/** Returns a JSON-RPC response object, or null for a notification (HTTP 202). */
export async function handleRpc(db: Db, msg: unknown): Promise<object | null> {
  if (typeof msg !== "object" || msg === null || Array.isArray(msg)) return rpcError(null, -32600, "Invalid Request");
  const m = msg as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
  const r = msg as { result?: unknown; error?: unknown };
  if (m.jsonrpc === "2.0" && m.method === undefined && (r.result !== undefined || r.error !== undefined)) return null; // a JSON-RPC response from the client: accept, no reply
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string") return rpcError(null, -32600, "Invalid Request");
  const hasId = m.id !== undefined;
  if (hasId && typeof m.id !== "string" && typeof m.id !== "number") return rpcError(null, -32600, "Invalid Request");
  if (!hasId) return null; // notification: no response
  const id = m.id as Id;

  const params = (m.params && typeof m.params === "object" ? m.params : {}) as Record<string, unknown>;
  switch (m.method) {
    case "initialize": {
      const asked = params.protocolVersion;
      const version = typeof asked === "string" && SUPPORTED.includes(asked) ? asked : SUPPORTED[0];
      return rpcOk(id, { protocolVersion: version, capabilities: { tools: {} }, serverInfo: SERVER });
    }
    case "ping":
      return rpcOk(id, {});
    case "tools/list":
      return rpcOk(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return rpcError(id, -32602, "Unknown tool");
      try {
        return rpcOk(id, toolText(await tool.run(db, params.arguments)));
      } catch (e) {
        if (e instanceof ToolError) return rpcOk(id, toolText({ error: e.code, message: e.message }, true));
        console.error("tool failure", tool.name, e instanceof Error ? e.name : "unknown"); // no details to the client
        return rpcOk(id, toolText({ error: "INTERNAL", message: "Internal error." }, true));
      }
    }
    default:
      return rpcError(id, -32601, "Method not found");
  }
}
