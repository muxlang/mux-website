import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  fetchIndexes: vi.fn(),
  searchFactory: vi.fn(),
  warn: vi.fn(),
}));
vi.mock("@docusaurus/useDocusaurusContext", () => ({
  default: () => ({ siteConfig: { baseUrl: "/", title: "Mux Docs" } }),
}));
vi.mock("@docusaurus/useGlobalData", () => ({
  usePluginData: () => ({
    indexHash: "hash",
    removeDefaultStopWordFilter: false,
    searchResultLimits: 5,
    translations: { no_documents_were_found: "No docs found" },
    externalSearchSources: [],
  }),
}));
vi.mock("../../utils/fetchIndexes", () => ({ fetchIndexes: mocks.fetchIndexes }));
vi.mock("../../utils/SearchSourceFactory", () => ({ SearchSourceFactory: mocks.searchFactory }));
vi.mock("../../utils/SearchAnalyticsFactory", () => ({ SearchAnalyticsFactory: () => vi.fn() }));

import SearchModal from "./SearchModal";

describe("SearchModal", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
    mocks.close.mockReset();
    mocks.warn.mockReset();
    mocks.fetchIndexes.mockResolvedValue({ wrappedIndexes: [] });
    mocks.searchFactory.mockReturnValue((_query, callback) => callback([]));
    vi.spyOn(console, "warn").mockImplementation(mocks.warn);
  });

  it("loads the local index, searches, and closes with Escape", async () => {
    render(<SearchModal onClose={mocks.close} />);
    expect(await screen.findByRole("dialog", { name: "Search documentation" })).toBeInTheDocument();
    await waitFor(() => expect(mocks.fetchIndexes).toHaveBeenCalledWith("/", "hash"));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "mux" } });
    expect(await screen.findByText("No docs found")).toBeInTheDocument();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("closes when the backdrop itself is clicked and reports index errors", async () => {
    mocks.fetchIndexes.mockRejectedValueOnce(new Error("invalid index"));
    const { container } = render(<SearchModal onClose={mocks.close} />);
    fireEvent.click(screen.getByRole("button", { name: "Close search" }));
    expect(mocks.close).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(mocks.warn).toHaveBeenCalledWith(
        "Unable to initialize search index from /",
        expect.any(Error),
      ),
    );
    expect(container.querySelector("input")).toBeInTheDocument();
  });
});
