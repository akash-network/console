import { z } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import { readableName, readableText } from "./readable-text";

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
});

describe(readableText.name, () => {
  it.each([
    { case: "an empty text", text: "" },
    { case: "a single line", text: "Storefront and checkout" },
    { case: "several lines with tabs", text: "Storefront\r\n\tand checkout\nfor the shop" }
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
});
