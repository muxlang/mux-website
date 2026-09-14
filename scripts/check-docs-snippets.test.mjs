import { describe, expect, it } from "vitest";
import { muxBlocks } from "./check-docs-snippets.mjs";

describe("docs snippet extraction", () => {
  it("rejects an unterminated mux fence", () => {
    expect(() => muxBlocks("```mux\nfunc main() returns void {\n")).toThrow(
      "unterminated mux fence starting at line 1",
    );
  });

  it("continues extracting a properly closed mux fence", () => {
    const blocks = muxBlocks("```mux\nfunc main() returns void {\n}\n```\n");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].body).toContain("func main()");
  });
});
