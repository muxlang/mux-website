import { describe, expect, it } from "vitest";
import { DEFAULT_MUX_API_URL, resolveApiUrl } from "./apiUrl";

describe("resolveApiUrl", () => {
  it("uses the public Worker when no API URL is configured", () => {
    expect(resolveApiUrl(undefined)).toBe(DEFAULT_MUX_API_URL);
    expect(resolveApiUrl({})).toBe(DEFAULT_MUX_API_URL);
  });

  it("accepts a configured URL and removes trailing slashes", () => {
    expect(resolveApiUrl({ apiUrl: "https://example.test///" })).toBe("https://example.test");
  });

  it("ignores non-string configuration values", () => {
    expect(resolveApiUrl({ apiUrl: null })).toBe(DEFAULT_MUX_API_URL);
    expect(resolveApiUrl({ apiUrl: 42 })).toBe(DEFAULT_MUX_API_URL);
  });
});
