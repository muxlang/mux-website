import { describe, expect, it } from "vitest";
import { language } from "./muxLanguage";

function commentToken(source: string): unknown {
  const rules = language.tokenizer?.whitespace;
  if (!Array.isArray(rules)) throw new Error("Mux whitespace tokenizer is missing");
  for (const rule of rules) {
    if (Array.isArray(rule) && rule[0] instanceof RegExp && rule[0].exec(source)?.index === 0) {
      return rule[1];
    }
  }
  throw new Error(`No comment rule matched ${source}`);
}

describe("MuxDoc highlighting", () => {
  it("distinguishes documentation comments from ordinary comments", () => {
    expect(commentToken("/// Documentation")).toBe("comment.doc");
    expect(commentToken("/** Documentation */")).toBe("comment.doc");
    expect(commentToken("// Ordinary")).toBe("comment");
    expect(commentToken("/* Ordinary */")).toBe("comment");
  });
});
