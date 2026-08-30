import { afterEach, describe, expect, it, vi } from "vitest";
import { sendChat } from "./chat";
import type { ChatMessage } from "../lib/chatTypes";

const messages: ChatMessage[] = [{ id: "user-1", role: "user", content: "What is Mux?" }];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendChat", () => {
  it("posts the conversation and returns a valid JSON response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "A language." }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(sendChat("https://api.example.test/", messages)).resolves.toEqual({
      message: "A language.",
    });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
  });

  it("maps a non-JSON rate-limit response to the stable error code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("slow down", {
        status: 429,
        statusText: "Too Many Requests",
      }),
    );

    await expect(sendChat("https://api.example.test", messages)).resolves.toEqual({
      error: "Too many requests. Please wait and try again.",
      errorCode: "RATE_LIMIT",
    });
  });

  it("returns useful status errors for an empty response body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));

    await expect(sendChat("https://api.example.test", messages)).resolves.toEqual({
      error: "Request failed (503)",
    });
  });

  it("rejects a successful response with neither message nor error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sources: [] }), { status: 200 }),
    );

    await expect(sendChat("https://api.example.test", messages)).resolves.toEqual({
      error: "Server returned an unexpected response",
    });
  });
});
