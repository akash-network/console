import { z } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import { readableLine, readableName, readableText } from "./readable-text";

describe(readableName.name, () => {
  it.each([
    { case: "a plain name", name: "Acme Corp" },
    { case: "a name padded with spaces", name: "  Acme  " },
    { case: "a name in a script without latin letters", name: "株式会社" },
    { case: "a name with an emoji", name: "Acme 🚀" }
  ])("accepts $case", ({ name }) => {
    expect(readableName(z.string()).safeParse(name)).toEqual({ success: true, data: name });
  });

  it.each([
    { case: "a null character", name: "Acme\u0000Corp", message: "The name cannot contain control characters" },
    { case: "a trailing null character", name: "Acme\u0000", message: "The name cannot contain control characters" },
    { case: "a line break", name: "Acme\nCorp", message: "The name cannot contain control characters" },
    { case: "a line separator", name: "Acme\u2028Corp", message: "The name cannot contain control characters" },
    { case: "a paragraph separator", name: "Acme\u2029Corp", message: "The name cannot contain control characters" },
    { case: "a right-to-left override", name: "Acme\u202eproc", message: "The name cannot contain control characters" },
    { case: "only spaces", name: "   ", message: "The name needs at least one visible character" },
    { case: "only zero-width spaces", name: "\u200b\u200b", message: "The name needs at least one visible character" },
    { case: "only a format character", name: "\ufff9", message: "The name needs at least one visible character" },
    { case: "only a Hangul filler", name: "\u3164", message: "The name needs at least one visible character" },
    { case: "only a blank braille pattern", name: "\u2800", message: "The name needs at least one visible character" },
    { case: "nothing", name: "", message: "The name needs at least one visible character" }
  ])("refuses $case", ({ name, message }) => {
    expect(readableName(z.string()).safeParse(name).error?.issues).toEqual([expect.objectContaining({ message })]);
  });

  it("keeps the checks of the schema it extends", () => {
    expect(readableName(z.string().max(3)).safeParse("Acme").success).toBe(false);
  });

  it("publishes a pattern that keeps its meaning when compiled without flags", () => {
    const pattern = publishedPatternOf(readableName(z.string()));

    expect(["Acme Corp", "Acme\u0000Corp", "Acme\u202eproc"].map(name => pattern.test(name))).toEqual([true, false, false]);
  });
});

describe(readableLine.name, () => {
  it.each([
    { case: "an empty line", line: "" },
    { case: "a line of spaces", line: "   " },
    { case: "a plain line", line: "Private chat on your own GPU" },
    { case: "a line in a script without latin letters", line: "チャット" },
    { case: "a line with an emoji sequence", line: "Family plan \u{1f468}\u200d\u{1f469}\u200d\u{1f467}" }
  ])("accepts $case", ({ line }) => {
    expect(readableLine(z.string()).safeParse(line)).toEqual({ success: true, data: line });
  });

  it.each([
    { case: "a null character", line: "about\u0000it" },
    { case: "a line break", line: "about\nit" },
    { case: "a line separator", line: "about\u2028it" },
    { case: "a paragraph separator", line: "about\u2029it" },
    { case: "a tab", line: "about\tit" },
    { case: "an escape character", line: "about\u001bit" },
    { case: "a right-to-left override", line: "about\u202eit" },
    { case: "a trailing right-to-left isolate", line: "about it\u2067" }
  ])("refuses $case", ({ line }) => {
    expect(readableLine(z.string()).safeParse(line).error?.issues).toEqual([
      expect.objectContaining({ message: "The text cannot contain control characters" })
    ]);
  });

  it("keeps the checks of the schema it extends", () => {
    expect(readableLine(z.string().max(3)).safeParse("Acme").success).toBe(false);
  });

  it("publishes a pattern that keeps its meaning when compiled without flags", () => {
    const pattern = publishedPatternOf(readableLine(z.string()));

    expect(["", "Private chat", "about\nit", "about\u202eit"].map(line => pattern.test(line))).toEqual([true, true, false, false]);
  });
});

describe(readableText.name, () => {
  it.each([
    { case: "an empty text", text: "" },
    { case: "a single line", text: "Storefront and checkout" },
    { case: "several lines with tabs", text: "Storefront\r\n\tand checkout\nfor the shop" },
    { case: "lines parted by line and paragraph separators", text: "Storefront\u2028and checkout\u2029for the shop" }
  ])("accepts $case", ({ text }) => {
    expect(readableText(z.string()).safeParse(text)).toEqual({ success: true, data: text });
  });

  it.each([
    { case: "a null character", text: "about\u0000it" },
    { case: "a trailing null character", text: "about it\u0000" },
    { case: "an escape character", text: "about\u001bit" },
    { case: "a right-to-left override", text: "about\u202eit" }
  ])("refuses $case", ({ text }) => {
    expect(readableText(z.string()).safeParse(text).error?.issues).toEqual([
      expect.objectContaining({ message: "The text cannot contain control characters other than line breaks and tabs" })
    ]);
  });

  it("publishes a pattern that keeps its meaning when compiled without flags", () => {
    const pattern = publishedPatternOf(readableText(z.string()));

    expect(["Storefront\r\n\tand checkout", "about\u0000it", "about\u202eit"].map(text => pattern.test(text))).toEqual([true, false, false]);
  });
});

function publishedPatternOf(schema: z.ZodString) {
  const [firstRegex] = schema._def.checks.flatMap(check => (check.kind === "regex" ? [check.regex] : []));

  return new RegExp(firstRegex.source);
}
