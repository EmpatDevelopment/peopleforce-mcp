const DEFAULT_BASE_URL = "https://app.peopleforce.io/api/public/v3";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 500;

export interface Pagination {
  page: number;
  pages: number;
  count: number;
  items: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  metadata?: { pagination?: Pagination };
}

export interface PeopleForceClientOptions {
  /** Base URL for the PeopleForce v3 API. */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Default 15000. */
  timeoutMs?: number;
  /** Max retry attempts for retryable failures (429 / 5xx / network). Default 3 (= up to 3 retries after the first try). */
  maxRetries?: number;
  /** Base backoff in ms; the nth retry waits `base * 2^(n-1)` (+jitter). Default 500. */
  retryBaseMs?: number;
  /** Inject a custom fetch for tests. Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Optional sleep override for tests. */
  sleep?: (ms: number) => Promise<void>;
}

export class PeopleForceError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
    public path: string,
    public attempts = 1,
  ) {
    super(message);
    this.name = "PeopleForceError";
  }
}

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function isTimeoutAbort(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PeopleForceClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(apiKey: string, options: string | PeopleForceClientOptions = {}) {
    if (!apiKey) {
      throw new Error("PEOPLEFORCE_API_KEY is required");
    }
    // Back-compat: old constructor signature was (apiKey, baseUrl: string).
    const opts: PeopleForceClientOptions = typeof options === "string" ? { baseUrl: options } : options;

    this.apiKey = apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = Math.max(0, opts.maxRetries ?? DEFAULT_MAX_RETRIES);
    this.retryBaseMs = Math.max(0, opts.retryBaseMs ?? DEFAULT_RETRY_BASE_MS);
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.sleep = opts.sleep ?? defaultSleep;
  }

  async get(path: string, query: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/${path.replace(/^\/+/, "")}`);
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }

    let attempt = 0;
    let lastError: PeopleForceError | undefined;

    while (attempt <= this.maxRetries) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method: "GET",
          headers: {
            "X-API-KEY": this.apiKey,
            Accept: "application/json",
            "User-Agent": "peopleforce-mcp/0.1",
          },
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        const isTimeout = isTimeoutAbort(err);
        const message = isTimeout
          ? `PeopleForce request timed out after ${this.timeoutMs}ms`
          : `PeopleForce network error: ${err instanceof Error ? err.message : String(err)}`;
        lastError = new PeopleForceError(message, 0, "", url.pathname + url.search, attempt);

        if (attempt <= this.maxRetries) {
          await this.sleep(this.backoffMs(attempt));
          continue;
        }
        throw lastError;
      }
      clearTimeout(timer);

      const bodyText = await res.text();
      if (!res.ok) {
        const hint =
          res.status === 401
            ? " — check PEOPLEFORCE_API_KEY"
            : res.status === 404
              ? " — endpoint may not exist on v3; try a different path"
              : res.status === 429
                ? " — rate limited"
                : "";
        lastError = new PeopleForceError(
          `PeopleForce ${res.status} ${res.statusText}${hint}`,
          res.status,
          bodyText.slice(0, 500),
          url.pathname + url.search,
          attempt,
        );

        if (RETRYABLE_STATUSES.has(res.status) && attempt <= this.maxRetries) {
          const retryAfter = res.headers.get("retry-after");
          const waitMs = retryAfter ? this.parseRetryAfter(retryAfter) : this.backoffMs(attempt);
          await this.sleep(waitMs);
          continue;
        }
        throw lastError;
      }

      try {
        return JSON.parse(bodyText);
      } catch {
        throw new PeopleForceError(
          "PeopleForce returned non-JSON response",
          res.status,
          bodyText.slice(0, 500),
          url.pathname,
          attempt,
        );
      }
    }

    // Unreachable — the loop either returns or throws — but satisfies TS.
    throw lastError ?? new PeopleForceError("unknown error", 0, "", url.pathname, attempt);
  }

  async list<T = unknown>(
    path: string,
    params: Record<string, string | number | boolean | undefined> = {},
  ): Promise<PaginatedResponse<T>> {
    return (await this.get(path, params)) as PaginatedResponse<T>;
  }

  /** Exponential backoff with full jitter. */
  private backoffMs(attempt: number): number {
    const expo = this.retryBaseMs * 2 ** (attempt - 1);
    return Math.floor(Math.random() * expo);
  }

  /** Parses both numeric-seconds and HTTP-date forms of Retry-After. */
  private parseRetryAfter(value: string): number {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const until = Date.parse(value);
    if (Number.isFinite(until)) return Math.max(0, until - Date.now());
    return this.retryBaseMs;
  }
}
