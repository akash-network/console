import { describe, expect, it } from "vitest";

import { tokenizeShellLine } from "./tokenizeShellLine";

describe(tokenizeShellLine.name, () => {
  it("returns a comment line as a single comment token", () => {
    expect(tokenizeShellLine("  # Wait for providers to bid")).toEqual([{ text: "  # Wait for providers to bid", kind: "comment" }]);
  });

  it("marks commands and quoted strings and leaves the rest plain", () => {
    expect(tokenizeShellLine(`curl -s "$API/v1/bids" | jq -ce '.data[0]'`)).toEqual([
      { text: "curl", kind: "command" },
      { text: " -s ", kind: "plain" },
      { text: '"$API/v1/bids"', kind: "string" },
      { text: " | ", kind: "plain" },
      { text: "jq", kind: "command" },
      { text: " -ce ", kind: "plain" },
      { text: "'.data[0]'", kind: "string" }
    ]);
  });

  it("marks a command only when it stands as a whole word", () => {
    expect(tokenizeShellLine("done; dseq=1; doneness")).toEqual([
      { text: "done", kind: "command" },
      { text: "; dseq=1; doneness", kind: "plain" }
    ]);
  });

  it("returns no tokens for an empty line", () => {
    expect(tokenizeShellLine("")).toEqual([]);
  });
});
