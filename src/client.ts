const DEFAULT_BASE_URL = "https://app.peopleforce.io/api/public/v3";

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

export class PeopleForceError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
    public path: string,
  ) {
    super(message);
    this.name = "PeopleForceError";
  }
}

export class PeopleForceClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl: string = DEFAULT_BASE_URL) {
    if (!apiKey) {
      throw new Error("PEOPLEFORCE_API_KEY is required");
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async get(path: string, query: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    const url = new URL(this.baseUrl + "/" + path.replace(/^\/+/, ""));
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-KEY": this.apiKey,
        Accept: "application/json",
        "User-Agent": "peopleforce-mcp/0.1",
      },
    });

    const bodyText = await res.text();
    if (!res.ok) {
      const hint = res.status === 401
        ? " — check PEOPLEFORCE_API_KEY"
        : res.status === 404
          ? " — endpoint may not exist on v3; try a different path"
          : "";
      throw new PeopleForceError(
        `PeopleForce ${res.status} ${res.statusText}${hint}`,
        res.status,
        bodyText.slice(0, 500),
        url.pathname + url.search,
      );
    }

    try {
      return JSON.parse(bodyText);
    } catch {
      throw new PeopleForceError(
        "PeopleForce returned non-JSON response",
        res.status,
        bodyText.slice(0, 500),
        url.pathname,
      );
    }
  }

  async list<T = unknown>(
    path: string,
    params: Record<string, string | number | boolean | undefined> = {},
  ): Promise<PaginatedResponse<T>> {
    return (await this.get(path, params)) as PaginatedResponse<T>;
  }
}
