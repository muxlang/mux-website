import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  fetchIndexes: vi.fn(),
  searchFactory: vi.fn(),
  updateSearchPath: vi.fn(),
}));
vi.mock("@docusaurus/useDocusaurusContext", () => ({
  default: () => ({ siteConfig: { baseUrl: "/" } }),
}));
vi.mock("@docusaurus/useGlobalData", () => ({
  usePluginData: () => ({
    indexHash: "hash",
    removeDefaultStopWordFilter: false,
    translations: {
      search_results_for: 'Results for "{{ keyword }}"',
      search_the_documentation: "Search documentation",
      count_documents_found: "{{ count }} result",
      count_documents_found_plural: "{{ count }} results",
      no_documents_were_found: "No results",
    },
  }),
}));
vi.mock("../hooks/useSearchQuery", () => ({
  default: () => ({ searchValue: "mux", updateSearchPath: mocks.updateSearchPath }),
}));
vi.mock("../../utils/fetchIndexes", () => ({ fetchIndexes: mocks.fetchIndexes }));
vi.mock("../../utils/SearchSourceFactory", () => ({ SearchSourceFactory: mocks.searchFactory }));
vi.mock("../../utils/SearchAnalyticsFactory", () => ({ SearchAnalyticsFactory: () => vi.fn() }));
vi.mock("@docusaurus/Layout", () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock("@docusaurus/Head", () => ({ default: ({ children }) => <>{children}</> }));
vi.mock("@docusaurus/Link", () => ({ default: ({ to, children }) => <a href={to}>{children}</a> }));

import SearchPage from "./SearchPage";

describe("SearchPage", () => {
  beforeEach(() => {
    mocks.fetchIndexes.mockResolvedValue({ wrappedIndexes: [] });
    mocks.searchFactory.mockImplementation(() => (_query, callback) => callback([]));
    mocks.updateSearchPath.mockReset();
  });

  it("shows query and empty-result states, and updates the URL as input changes", async () => {
    render(<SearchPage />);
    expect(screen.getByRole("heading", { name: 'Results for "mux"' })).toBeInTheDocument();
    await vi.waitFor(() => expect(mocks.fetchIndexes).toHaveBeenCalledWith("/", "hash"));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(mocks.updateSearchPath).toHaveBeenCalledWith("");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nope" } });
    expect(
      await screen.findByText(
        "⚠️ The search index is only available when you run docusaurus build!",
      ),
    ).toBeInTheDocument();
  });

  it("renders title, heading, and content results with their destination paths", async () => {
    const stemmedMetadata = { title: { t: { position: [[0, 3]] } } };
    mocks.searchFactory.mockImplementation(
      () => (_query, callback) =>
        callback([
          {
            document: {
              i: "title",
              u: "/guide",
              h: "#intro",
              b: ["Guide"],
              t: "Mux Guide",
              metadata: stemmedMetadata,
            },
            type: 0,
            tokens: ["Mux"],
            metadata: stemmedMetadata,
          },
          {
            document: {
              i: "heading",
              u: "/guide",
              h: "#install",
              b: ["Guide"],
              t: "Mux Guide",
              metadata: stemmedMetadata,
            },
            type: 1,
            page: { b: ["Docs"], t: "Install" },
            tokens: ["Mux"],
            metadata: stemmedMetadata,
          },
          {
            document: {
              i: "content",
              u: "/guide",
              h: "#usage",
              b: ["Guide"],
              t: "Mux Guide",
              s: "Mux content",
              metadata: stemmedMetadata,
            },
            type: 2,
            page: { b: ["Docs"], t: "Usage" },
            tokens: ["Mux"],
            metadata: stemmedMetadata,
          },
        ]),
    );

    const { container } = render(<SearchPage />);

    expect(await screen.findByText("3 results")).toBeInTheDocument();
    expect(screen.getAllByText("Guide")).toHaveLength(2);
    expect(screen.getByText("Docs › Install")).toBeInTheDocument();
    expect(screen.getByText("Docs › Usage")).toBeInTheDocument();
    expect(container.querySelector('a[href="/guide#usage"]')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element.tagName === "P" && element.textContent === "Mux Guide",
      ),
    ).toBeInTheDocument();
  });
});
