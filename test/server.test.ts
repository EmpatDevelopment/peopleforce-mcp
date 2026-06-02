import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { test } from "node:test";
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
    proc.stdin.write(`${JSON.stringify(m)}\n`);
  }
  proc.stdin.end();
  const [code] = await once(proc, "close");
  return { out, err, code: code as number };
}

test("server lists expected tools", { timeout: 10000 }, async () => {
  const res = await rpc(
    [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } },
      },
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
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } },
      },
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

test("denylist removes tool from manifest and tools/call returns Unknown", { timeout: 10000 }, async () => {
  const res = await rpc(
    [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } },
      },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "peopleforce_api_request", arguments: { path: "employees" } },
      },
    ],
    { PEOPLEFORCE_API_KEY: "test-key", PEOPLEFORCE_DISABLED_TOOLS: "peopleforce_api_request" },
  );
  const lines = res.out
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const listResp = lines.find((m) => m.id === 2);
  const callResp = lines.find((m) => m.id === 3);
  assert.ok(listResp, `no tools/list response; stderr=${res.err}`);
  const names: string[] = listResp.result.tools.map((t: { name: string }) => t.name);
  assert.ok(!names.includes("peopleforce_api_request"), `api_request must be denied; got ${names.join(", ")}`);
  assert.ok(callResp);
  assert.equal(callResp.result.isError, true);
  assert.match(callResp.result.content[0].text, /Unknown tool/);
});

test("allowlist narrows manifest to exactly listed tools", { timeout: 10000 }, async () => {
  const res = await rpc(
    [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } },
      },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "peopleforce_list_departments", arguments: {} },
      },
    ],
    {
      PEOPLEFORCE_API_KEY: "test-key",
      PEOPLEFORCE_ENABLED_TOOLS: "peopleforce_list_employees,peopleforce_get_employee",
    },
  );
  const lines = res.out
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const listResp = lines.find((m) => m.id === 2);
  const callResp = lines.find((m) => m.id === 3);
  assert.ok(listResp, `no tools/list response; stderr=${res.err}`);
  const names: string[] = listResp.result.tools.map((t: { name: string }) => t.name);
  assert.deepEqual(names.sort(), ["peopleforce_get_employee", "peopleforce_list_employees"].sort());
  assert.ok(callResp);
  assert.equal(callResp.result.isError, true);
  assert.match(callResp.result.content[0].text, /Unknown tool/);
});

test("allow+deny compose and accept prefix-less, case-insensitive tokens", { timeout: 10000 }, async () => {
  const res = await rpc(
    [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } },
      },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
    ],
    {
      PEOPLEFORCE_API_KEY: "test-key",
      PEOPLEFORCE_ENABLED_TOOLS: "list_employees, Get_Employee",
      PEOPLEFORCE_DISABLED_TOOLS: "get_employee",
    },
  );
  const lines = res.out
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const listResp = lines.find((m) => m.id === 2);
  assert.ok(listResp, `no tools/list response; stderr=${res.err}`);
  const names: string[] = listResp.result.tools.map((t: { name: string }) => t.name);
  assert.deepEqual(names, ["peopleforce_list_employees"], `deny must subtract from allow; got ${names.join(", ")}`);
});

test("unknown token in denylist logs WARN and starts normally", { timeout: 10000 }, async () => {
  const res = await rpc(
    [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } },
      },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
    ],
    {
      PEOPLEFORCE_API_KEY: "test-key",
      PEOPLEFORCE_DISABLED_TOOLS: "peopleforce_does_not_exist,peopleforce_api_request",
    },
  );
  const lines = res.out
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const listResp = lines.find((m) => m.id === 2);
  assert.ok(listResp, `server must respond; stderr=${res.err}`);
  const names: string[] = listResp.result.tools.map((t: { name: string }) => t.name);
  assert.ok(!names.includes("peopleforce_api_request"), "valid deny entry must still apply");
  assert.match(res.err, /unknown tool name "peopleforce_does_not_exist"/);
});

test("filter that exposes zero tools exits with code 1", { timeout: 10000 }, async () => {
  const proc = spawn("node", [ENTRY], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      PEOPLEFORCE_API_KEY: "test-key",
      PEOPLEFORCE_ENABLED_TOOLS: "peopleforce_does_not_exist",
    },
  });
  let err = "";
  proc.stderr.on("data", (d) => (err += d.toString()));
  proc.stdin.end();
  const [code] = await once(proc, "close");
  assert.equal(code, 1, `expected exit 1; stderr=${err}`);
  assert.match(err, /zero exposed tools/);
});
