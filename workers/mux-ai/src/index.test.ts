import assert from "node:assert/strict";
import test from "node:test";
import worker, { ChatRateLimiter, type Env } from "./index";

const env = {
  ALLOWED_ORIGIN: "https://mux-lang.dev",
  ENVIRONMENT: "production",
} as Env;

test("rejects a serialized body above the request limit", async () => {
  const request = new Request("https://example.test/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "131073" },
    body: JSON.stringify({ messages: [] }),
  });

  const response = await worker.fetch(request, env);

  assert.equal(response.status, 400);
  assert.match(await response.text(), /Invalid JSON body|too large/);
});

test("rejects an oversized chunked body before buffering it", async () => {
  const oversized = new Uint8Array(128 * 1024 + 1);
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(oversized);
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("https://example.test/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stream,
    // Node’s Request type requires this for a streaming request body; the
    // Worker runtime ignores the fetch-client-only option.
    duplex: "half",
  } as RequestInit);

  const response = await worker.fetch(request, env);

  assert.equal(response.status, 400);
  assert.match(await response.text(), /Invalid JSON body|too large/);
  assert.equal(cancelled, true);
});

test("rejects a message array above the bounded conversation limit", async () => {
  const messages = Array.from({ length: 33 }, () => ({
    role: "user",
    content: "hello",
  }));
  const request = new Request("https://example.test/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  const response = await worker.fetch(request, env);

  assert.equal(response.status, 400);
  assert.match(await response.text(), /at most 32/);
});

test("production rejects valid chat requests when the durable limiter is absent", async () => {
  const request = new Request("https://example.test/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
  });

  const response = await worker.fetch(request, env);

  assert.equal(response.status, 503);
  const body = (await response.json()) as {
    error?: string;
    errorCode?: string;
  };
  assert.match(body.error ?? "", /rate-limit service/);
  assert.equal(body.errorCode, "MODEL_UNAVAILABLE");
});

test("durable limiter admits a request then applies the cooldown", async () => {
  const values = new Map<string, number>();
  const state = {
    storage: {
      get: async <T>(key: string) => values.get(key) as T | undefined,
      put: async (key: string, value: number) => {
        values.set(key, value);
      },
    },
  } as unknown as DurableObjectState;
  const limiter = new ChatRateLimiter(state);

  const first = await limiter.fetch(new Request("https://example.test/check", { method: "POST" }));
  const second = await limiter.fetch(new Request("https://example.test/check", { method: "POST" }));

  assert.equal(first.status, 204);
  assert.equal(second.status, 429);
});

test("durable limiter rejects non-POST requests", async () => {
  const state = {
    storage: { get: async () => undefined, put: async () => undefined },
  } as unknown as DurableObjectState;
  const limiter = new ChatRateLimiter(state);

  const response = await limiter.fetch(new Request("https://example.test/check"));

  assert.equal(response.status, 405);
});

function compileEnv(): Env {
  return {
    ALLOWED_ORIGIN: "https://mux-lang.dev",
    ENVIRONMENT: "production",
    MUX_API_ORIGIN: "https://mux-lang-api.fly.dev",
    MUX_API_ORIGIN_TOKEN: "origin-token",
    CHAT_RATE_LIMITER: {
      idFromName: () => ({}) as DurableObjectId,
      get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
    } as unknown as DurableObjectNamespace,
  } as Env;
}

test("compile proxy rejects non-POST requests", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/api/compile"),
    compileEnv(),
  );

  assert.equal(response.status, 405);
});

test("health alias supports the website API warmup path", async () => {
  const originalFetch = globalThis.fetch;
  let upstreamRequest: Request | undefined;
  globalThis.fetch = async (input, init) => {
    upstreamRequest = new Request(input, init);
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const response = await worker.fetch(new Request("https://example.test/health"), compileEnv());

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
    assert.equal(upstreamRequest?.url, "https://mux-lang-api.fly.dev/health");
    assert.equal(upstreamRequest?.headers.get("X-Mux-Origin-Token"), "origin-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("compile proxy fails closed when production origin settings are absent", async () => {
  const incomplete = { ...compileEnv(), MUX_API_ORIGIN_TOKEN: undefined };
  const response = await worker.fetch(
    new Request("https://example.test/api/compile", {
      method: "POST",
      body: JSON.stringify({ code: "print(1)" }),
      headers: { "content-type": "application/json" },
    }),
    incomplete,
  );

  assert.equal(response.status, 503);
});

test("compile proxy forwards validated code with the private origin token", async () => {
  const originalFetch = globalThis.fetch;
  let upstreamRequest: Request | undefined;
  globalThis.fetch = async (input, init) => {
    upstreamRequest = new Request(input, init);
    return new Response(JSON.stringify({ output: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const response = await worker.fetch(
      new Request("https://example.test/api/compile", {
        method: "POST",
        body: JSON.stringify({ code: "print(1)" }),
        headers: { "content-type": "application/json" },
      }),
      compileEnv(),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { output: "ok" });
    assert.equal(upstreamRequest?.url, "https://mux-lang-api.fly.dev/api/compile");
    assert.equal(upstreamRequest?.headers.get("X-Mux-Origin-Token"), "origin-token");
    assert.deepEqual(await upstreamRequest?.json(), { code: "print(1)" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("compile proxy rejects oversized source before contacting the origin", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response(null, { status: 500 });
  };

  try {
    const response = await worker.fetch(
      new Request("https://example.test/api/compile", {
        method: "POST",
        body: JSON.stringify({ code: "x".repeat(100 * 1024 + 1) }),
      }),
      compileEnv(),
    );

    assert.equal(response.status, 413);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("compile proxy permits escaped source within the decoded source limit", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response(JSON.stringify({ output: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const code = "\\".repeat(50 * 1024);
    const response = await worker.fetch(
      new Request("https://example.test/api/compile", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
      compileEnv(),
    );

    assert.equal(response.status, 200);
    assert.equal(called, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
