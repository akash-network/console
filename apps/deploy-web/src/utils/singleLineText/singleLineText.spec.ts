import { describe, expect, it } from "vitest";

import { toSingleLine } from "./singleLineText";

describe(toSingleLine.name, () => {
  it.each([
    ["a line feed", "\n"],
    ["a carriage return and line feed", "\r\n"],
    ["a tab", "\t"],
    ["a vertical tab", "\v"],
    ["a form feed", "\f"],
    ["a next-line character", String.fromCharCode(0x85)],
    ["a line separator", String.fromCharCode(0x2028)],
    ["a paragraph separator", String.fromCharCode(0x2029)],
    ["several blank lines", "\n\n\n"]
  ])("puts one space where %s was", (_, lineBreak) => {
    expect(toSingleLine(`Chat with models${lineBreak}on your own GPU`)).toBe("Chat with models on your own GPU");
  });

  it("takes the spaces around a line break with it", () => {
    expect(toSingleLine("Chat with models  \n   on your own GPU")).toBe("Chat with models on your own GPU");
  });

  it("flattens every line break in the text", () => {
    expect(toSingleLine("one\ntwo\nthree")).toBe("one two three");
  });

  it("trims the ends and keeps the spacing inside a line", () => {
    expect(toSingleLine("  Chat  with models ")).toBe("Chat  with models");
    expect(toSingleLine("\n Chat with models \n\n")).toBe("Chat with models");
  });

  it("answers nothing for text that is only line breaks and spaces", () => {
    expect(toSingleLine(" \n\t \n ")).toBe("");
  });

  it("flattens a long run of spaces without a line break quickly", () => {
    const text = `a${" ".repeat(200_000)}b`;
    const startedAt = performance.now();

    expect(toSingleLine(text)).toBe(text);
    expect(performance.now() - startedAt).toBeLessThan(500);
  });
});
