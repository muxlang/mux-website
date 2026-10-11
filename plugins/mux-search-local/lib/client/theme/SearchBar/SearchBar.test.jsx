import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@docusaurus/useGlobalData", () => ({
  usePluginData: () => ({ highlightSearchTermsOnTargetPage: false }),
}));
vi.mock("../SearchModal", () => ({
  default: ({ onClose }) => (
    <div role="dialog">
      <button onClick={onClose}>Close search</button>
    </div>
  ),
}));

import { SearchBar } from "./SearchBar";

describe("SearchBar", () => {
  it("opens from the button and shortcuts, while ignoring slash inside inputs", () => {
    render(<SearchBar />);
    fireEvent.keyDown(window, { key: "/" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const input = document.createElement("input");
    document.body.append(input);
    fireEvent.keyDown(input, { key: "/" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    input.remove();

    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    fireEvent.keyDown(window, { keyCode: 27 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
