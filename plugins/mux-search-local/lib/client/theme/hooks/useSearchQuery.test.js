import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("@docusaurus/router", () => ({
  useHistory: () => ({ replace: mocks.replace }),
  useLocation: () => ({ search: "?q=hello+world" }),
}));
vi.mock("@docusaurus/useDocusaurusContext", () => ({
  default: () => ({ siteConfig: { baseUrl: "/manual/" } }),
}));

import useSearchQuery from "./useSearchQuery";

describe("useSearchQuery", () => {
  it("reads the current query and creates stable search routes", () => {
    const { result } = renderHook(() => useSearchQuery());
    expect(result.current.searchValue).toBe("hello world");
    result.current.updateSearchPath("");
    expect(mocks.replace).toHaveBeenCalledWith({ search: "" });
    expect(result.current.generateSearchPageLink("c++ & mux")).toBe(
      "/manual/search?q=c%2B%2B%20%26%20mux",
    );
  });
});
