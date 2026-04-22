import assert from "node:assert/strict";
import { test } from "node:test";
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
  const { fn, calls } = mockFetch([
    { status: 200, body: { data: [], metadata: { pagination: { page: 1, pages: 1, count: 0, items: 0 } } } },
  ]);
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

test("PeopleForceClient retries on 429 and eventually succeeds", async () => {
  const { fn, calls } = mockFetch([
    { status: 429, body: { error: "rate limited" }, headers: { "retry-after": "0" } },
    { status: 429, body: { error: "rate limited" }, headers: { "retry-after": "0" } },
    { status: 200, body: { data: [{ id: 1 }] } },
  ]);
  const sleeps: number[] = [];
  const c = new PeopleForceClient("k", {
    fetch: fn as unknown as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    maxRetries: 5,
  });
  const res = (await c.get("employees")) as { data: unknown[] };
  assert.deepEqual(res.data, [{ id: 1 }]);
  assert.equal(calls.length, 3);
  assert.equal(sleeps.length, 2, "should sleep twice between 3 attempts");
});

test("PeopleForceClient stops retrying after maxRetries and throws with attempts=N+1", async () => {
  const { fn } = mockFetch([
    { status: 503, body: "unavailable" },
    { status: 503, body: "unavailable" },
    { status: 503, body: "unavailable" },
  ]);
  const c = new PeopleForceClient("k", {
    fetch: fn as unknown as typeof fetch,
    sleep: async () => {},
    maxRetries: 2,
  });
  await assert.rejects(
    () => c.get("employees"),
    (err: unknown) => {
      assert.ok(err instanceof PeopleForceError);
      assert.equal((err as PeopleForceError).status, 503);
      assert.equal((err as PeopleForceError).attempts, 3, "tried 3 times = 1 initial + 2 retries");
      return true;
    },
  );
});

test("PeopleForceClient does NOT retry on non-retryable 401", async () => {
  const { fn, calls } = mockFetch([{ status: 401, body: { error: "unauthorized" } }]);
  const c = new PeopleForceClient("bad", {
    fetch: fn as unknown as typeof fetch,
    sleep: async () => {},
    maxRetries: 5,
  });
  await assert.rejects(() => c.get("employees"));
  assert.equal(calls.length, 1, "401 must not be retried");
});

test("PeopleForceClient honors numeric Retry-After header", async () => {
  const { fn } = mockFetch([
    { status: 429, body: "too many", headers: { "retry-after": "2" } },
    { status: 200, body: { data: [] } },
  ]);
  const sleeps: number[] = [];
  const c = new PeopleForceClient("k", {
    fetch: fn as unknown as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  await c.get("employees");
  assert.deepEqual(sleeps, [2000], "Retry-After: 2 → wait 2000ms");
});

test("PeopleForceClient times out long requests and retries", async () => {
  let attempt = 0;
  const fn = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    attempt += 1;
    if (attempt < 3) {
      // Simulate hang — wait for the AbortController to fire, then throw AbortError.
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }
    return new Response(JSON.stringify({ data: [{ ok: true }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  const c = new PeopleForceClient("k", {
    fetch: fn,
    sleep: async () => {},
    timeoutMs: 20,
    maxRetries: 3,
  });
  const res = (await c.get("employees")) as { data: unknown[] };
  assert.deepEqual(res.data, [{ ok: true }]);
  assert.equal(attempt, 3, "one success after two timeouts");
});
