import { describe, expect, it } from "vitest";
import { getHighlighter } from "./highlighter";

describe("Mux block comments", () => {
  it("keeps nested comments scoped through their outer closing delimiter", async () => {
    const highlighter = await getHighlighter();

    const tokens = highlighter.codeToTokens(
      "/** outer /* inner /* deeper */ inner */ outer */ let x = 1",
      // The language is loaded at runtime, outside Shiki's bundled language union.
      { lang: "source.mux" as never, theme: "github-light", includeExplanation: true },
    ).tokens[0];
    const comment = tokens.find((token) => token.content.includes("outer */"));
    const code = tokens.find((token) => token.content.includes("let"));

    expect(
      comment?.explanation?.some(
        (part) =>
          part.content.includes("outer") &&
          part.scopes.some((scope) => scope.scopeName === "comment.block.documentation"),
      ),
    ).toBe(true);
    expect(
      code?.explanation?.some((part) =>
        part.scopes.some((scope) => scope.scopeName.startsWith("comment.block")),
      ),
    ).toBe(false);
  });
});
