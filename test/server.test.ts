import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Compiled test lives at dist-test/test/server.test.js, so go up two dirs to project root.
const ENTRY = path.resolve(__dirname, "../../dist/index.js");

// Requires `npm run build` to have produced dist/index.js.
// This test spawns the actual MCP server over stdio and checks the tool manifest.

async function rpc(messages: object[], env: Record<string, string>) {
  const proc = spawn("node", [ENTRY], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  let out = "";
  let err = "";
  proc.stdout.on("data", (d) => (out += d.toString()));
  proc.stderr.on("data", (d) => (err += d.toString()));
  for (const m of messages) {
    proc.stdin.write(JSON.stringify(m) + "\n");
  }
  proc.stdin.end();
  const [code] = await once(proc, "close");
  return { out, err, code: code as number };
}

test("server lists expected tools", { timeout: 10000 }, async () => {
  const res = await rpc(
    [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } } },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
    ],
    { PEOPLEFORCE_API_KEY: "test-key" },
  );
  const lines = res.out.split("\n").filter(Boolean);
  const listResp = lines.map((l) => JSON.parse(l)).find((m) => m.id === 2);
  assert.ok(listResp, `no tools/list response; stderr=${res.err}`);
  const names: string[] = listResp.result.tools.map((t: { name: string }) => t.name);
  const expected = [
    "peopleforce_list_employees",
    "peopleforce_get_employee",
    "peopleforce_find_employee_by_email",
    "peopleforce_list_employee_positions",
    "peopleforce_list_leave_requests",
    "peopleforce_list_departments",
    "peopleforce_list_leave_types",
    "peopleforce_list_recruitment_vacancies",
    "peopleforce_list_recruitment_candidates",
    "peopleforce_list_recruitment_pipelines",
    "peopleforce_list_employee_documents",
    "peopleforce_list_employee_assets",
    "peopleforce_api_request",
  ];
  for (const t of expected) {
    assert.ok(names.includes(t), `missing tool ${t}; got ${names.join(", ")}`);
  }
  assert.ok(names.length >= 25, `expected at least 25 tools, got ${names.length}`);
});

test("server exits with helpful error when API key missing", { timeout: 10000 }, async () => {
  const proc = spawn("node", [ENTRY], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PEOPLEFORCE_API_KEY: "" },
  });
  let err = "";
  proc.stderr.on("data", (d) => (err += d.toString()));
  const [code] = await once(proc, "close");
  assert.equal(code, 1);
  assert.match(err, /PEOPLEFORCE_API_KEY/);
});

test("tool call validates required arguments", { timeout: 10000 }, async () => {
  const res = await rpc(
    [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } } },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "peopleforce_get_employee", arguments: {} } },
    ],
    { PEOPLEFORCE_API_KEY: "test-key" },
  );
  const lines = res.out.split("\n").filter(Boolean);
  const callResp = lines.map((l) => JSON.parse(l)).find((m) => m.id === 2);
  assert.ok(callResp);
  assert.equal(callResp.result.isError, true);
  assert.match(callResp.result.content[0].text, /Invalid arguments/);
});
