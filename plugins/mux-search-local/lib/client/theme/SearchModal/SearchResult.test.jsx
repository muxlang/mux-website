import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@docusaurus/router", () => ({ useHistory: () => ({ push: mocks.push }) }));
vi.mock("@docusaurus/useGlobalData", () => ({
  usePluginData: () => ({
    searchResultContextMaxLength: 40,
    highlightSearchTermsOnTargetPage: true,
  }),
}));
vi.mock("@theme-original/Icon/ExternalLink", () => ({ default: () => <span>external</span> }));

import SearchResultList from "./SearchResultList";
import SearchResultsSection from "./SearchResultsSection";

describe("search result components", () => {
  beforeEach(() => mocks.push.mockReset());

  it("renders result sections and navigates from an accessible result button", () => {
    const result = {
      document: { i: 4, t: "Mux guide", u: "/docs/guide", h: "#setup" },
      type: 1,
      page: { t: "Guides" },
      tokens: ["mux"],
      metadata: { title: { t: { position: [[0, 3]] } } },
      isLastOfTree: true,
    };
    const onClick = vi.fn();
    const setHovered = vi.fn();
    const setSelected = vi.fn();
    render(
      <SearchResultsSection heading="Docs" headingLink="https://example.com" sectionQuery="mux">
        <SearchResultList
          results={[result]}
          cursor={0}
          onSearchResultClick={onClick}
          setHovered={setHovered}
          setSelected={setSelected}
        />
      </SearchResultsSection>,
    );

    expect(screen.getByRole("link", { name: /Docs/ })).toHaveAttribute(
      "href",
      "https://example.com/search?q=mux",
    );
    const button = screen.getByRole("button", { name: /Mux guide/ });
    fireEvent.mouseEnter(button);
    fireEvent.click(button);
    expect(setHovered).toHaveBeenCalledWith(result);
    expect(mocks.push).toHaveBeenCalledWith("/docs/guide?_highlight=mux#setup");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders no list for empty results", () => {
    const { container } = render(
      <SearchResultList results={[]} cursor={0} setHovered={vi.fn()} setSelected={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
