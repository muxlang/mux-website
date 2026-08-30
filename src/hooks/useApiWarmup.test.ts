import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useApiWarmup from "./useApiWarmup";

vi.mock("@docusaurus/useDocusaurusContext", () => ({
  default: () => ({
    siteConfig: { customFields: { apiUrl: "https://worker.example.test/" } },
  }),
}));

beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useApiWarmup", () => {
  it("warms the API once and records the browser-session marker", () => {
    const { unmount } = renderHook(() => useApiWarmup());

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith("https://worker.example.test/health");
    expect(sessionStorage.getItem("mux-api-warmed")).toBe("1");

    unmount();
    renderHook(() => useApiWarmup());
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("skips the request when this browser session was already warmed", () => {
    sessionStorage.setItem("mux-api-warmed", "1");

    renderHook(() => useApiWarmup());

    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not surface a rejected best-effort warmup request", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("API unavailable"));

    renderHook(() => useApiWarmup());
    await Promise.resolve();

    expect(fetch).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("mux-api-warmed")).toBe("1");
  });

  it("skips warming when session storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    renderHook(() => useApiWarmup());

    expect(fetch).not.toHaveBeenCalled();
  });

  it("still makes one best-effort request when the marker cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    renderHook(() => useApiWarmup());
    expect(fetch).toHaveBeenCalledOnce();
  });
});
