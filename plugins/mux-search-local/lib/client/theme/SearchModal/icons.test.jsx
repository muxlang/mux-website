import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import * as Icons from "./icons";

describe("search icons", () => {
  it("renders each icon used by the local search theme", () => {
    for (const Icon of Object.values(Icons)) {
      const { container, unmount } = render(<Icon />);
      expect(container.querySelector("svg")).toBeInTheDocument();
      unmount();
    }
  });
});
