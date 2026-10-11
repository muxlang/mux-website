import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SearchButton } from "./SearchButton";

describe("SearchButton", () => {
  it("renders an accessible platform shortcut", () => {
    render(<SearchButton translations={{ buttonText: "Find", buttonAriaLabel: "Find docs" }} />);
    expect(screen.getByRole("button", { name: /Find docs/ })).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+k",
    );
    expect(screen.getByText("Find")).toBeInTheDocument();
  });
});
