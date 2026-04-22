import { test } from "node:test";
import assert from "node:assert/strict";
import { PeopleForceClient, PeopleForceError } from "../src/client.js";

type FetchArgs = { url: string; init?: RequestInit };

function mockFetch(responses: Array<{ status: number; body: unknown; headers?: Record<string, string> }>) {
  const calls: FetchArgs[] = [];
  let i = 0;
  const fn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input.toString() : String(input);
    calls.push({ url, init });
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    const body = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    return new Response(body, {
      status: r.status,
      headers: { "content-type": "application/json", ...(r.headers ?? {}) },
    });
  };
  return { fn, calls };
}

test("PeopleForceClient throws on missing API key", () => {
  assert.throws(() => new PeopleForceClient(""), /PEOPLEFORCE_API_KEY/);
});

test("PeopleForceClient.get sends X-API-KEY header and encodes query", async () => {
  const { fn, calls } = mockFetch([{ status: 200, body: { data: [], metadata: { pagination: { page: 1, pages: 1, count: 0, items: 0 } } } }]);
  const origFetch = globalThis.fetch;
  (globalThis as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch;
  try {
    const c = new PeopleForceClient("secret-key", "https://example.test/api/public/v3");
    const res = await c.list("employees", { status: "probation", per_page: 10 });
    assert.deepEqual(res.data, []);
    assert.equal(calls.length, 1);
    const call = calls[0];
    assert.ok(call.url.includes("status=probation"));
    assert.ok(call.url.includes("per_page=10"));
    assert.ok(call.url.startsWith("https://example.test/api/public/v3/employees"));
    const headers = new Headers(call.init?.headers);
    assert.equal(headers.get("x-api-key"), "secret-key");
    assert.equal(headers.get("accept"), "application/json");
  } finally {
    (globalThis as { fetch: typeof fetch }).fetch = origFetch;
  }
});

test("PeopleForceClient strips undefined/empty query params", async () => {
  const { fn, calls } = mockFetch([{ status: 200, body: { data: [] } }]);
  const orig = globalThis.fetch;
  (globalThis as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch;
  try {
    const c = new PeopleForceClient("k");
    await c.get("departments", { page: 1, status: undefined, q: "" });
    assert.ok(!calls[0].url.includes("status="));
    assert.ok(!calls[0].url.includes("q="));
    assert.ok(calls[0].url.includes("page=1"));
  } finally {
    (globalThis as { fetch: typeof fetch }).fetch = orig;
  }
});

test("PeopleForceClient raises PeopleForceError with hint on 401", async () => {
  const { fn } = mockFetch([{ status: 401, body: { error: "unauthorized" } }]);
  const orig = globalThis.fetch;
  (globalThis as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch;
  try {
    const c = new PeopleForceClient("bad");
    await assert.rejects(
      () => c.get("employees"),
      (err: unknown) => {
        assert.ok(err instanceof PeopleForceError);
        assert.equal((err as PeopleForceError).status, 401);
        assert.match((err as PeopleForceError).message, /check PEOPLEFORCE_API_KEY/);
        return true;
      },
    );
  } finally {
    (globalThis as { fetch: typeof fetch }).fetch = orig;
  }
});

test("PeopleForceClient raises on 404 with 'endpoint may not exist' hint", async () => {
  const { fn } = mockFetch([{ status: 404, body: "Not found" }]);
  const orig = globalThis.fetch;
  (globalThis as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch;
  try {
    const c = new PeopleForceClient("k");
    await assert.rejects(
      () => c.get("nonexistent"),
      (err: unknown) => {
        assert.ok(err instanceof PeopleForceError);
        assert.equal((err as PeopleForceError).status, 404);
        assert.match((err as PeopleForceError).message, /endpoint may not exist/);
        return true;
      },
    );
  } finally {
    (globalThis as { fetch: typeof fetch }).fetch = orig;
  }
});

test("PeopleForceClient normalizes trailing slash in baseUrl", async () => {
  const { fn, calls } = mockFetch([{ status: 200, body: { data: [] } }]);
  const orig = globalThis.fetch;
  (globalThis as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch;
  try {
    const c = new PeopleForceClient("k", "https://example.test/api/public/v3/");
    await c.get("employees/42");
    assert.equal(new URL(calls[0].url).pathname, "/api/public/v3/employees/42");
  } finally {
    (globalThis as { fetch: typeof fetch }).fetch = orig;
  }
});
