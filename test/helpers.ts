import { vi } from "vitest";

export interface RecordedCall {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

/** A fetch double that returns queued responses (FIFO) and records requests. */
export function mockFetch(...handlers: Handler[]) {
  const recorded: RecordedCall[] = [];
  const queue = [...handlers];
  const fn = vi.fn(async (input: unknown, init: RequestInit = {}) => {
    const url = String(input);
    recorded.push({
      method: init.method ?? "GET",
      url,
      headers: (init.headers as Record<string, string>) ?? {},
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    const h = queue.shift();
    if (!h) throw new Error(`unexpected request: ${init.method} ${url}`);
    return h(url, init);
  });
  return Object.assign(fn as unknown as typeof fetch, { recorded });
}

/** Build a JSON Response, optionally with Set-Cookie headers. */
export function json(status: number, body?: unknown, setCookie?: string[]): Response {
  const headers = new Headers({ "content-type": "application/json" });
  for (const c of setCookie ?? []) headers.append("set-cookie", c);
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
}

/** An empty (204) Response with Set-Cookie headers. */
export function noContent(setCookie?: string[]): Response {
  const headers = new Headers();
  for (const c of setCookie ?? []) headers.append("set-cookie", c);
  return new Response(null, { status: 204, headers });
}
