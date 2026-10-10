import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { UNSCOPED_REASONS } from "./unscoped-reasons";

const SOURCE_ROOT = path.resolve(__dirname, "../..");
const REGISTRY_FILE = path.join("core", "repositories", "unscoped-reasons.ts");
const UNSCOPED_CALL = /\.unscoped\(\s*"([^"]+)"\s*\)/g;

describe("UNSCOPED_REASONS", () => {
  it("registers every reason the source code passes to unscoped()", () => {
    const usedReasons = sourceFiles().flatMap(({ content }) => [...content.matchAll(UNSCOPED_CALL)].map(([, reason]) => reason));

    expect(usedReasons).not.toHaveLength(0);
    expect(usedReasons.filter(reason => !UNSCOPED_REASONS.includes(reason as (typeof UNSCOPED_REASONS)[number]))).toEqual([]);
  });

  it("holds no reason that the source code never passes", () => {
    const files = sourceFiles().filter(({ file }) => file !== REGISTRY_FILE);

    expect(UNSCOPED_REASONS.filter(reason => !files.some(({ content }) => content.includes(`"${reason}"`)))).toEqual([]);
  });

  function sourceFiles() {
    return readdirSync(SOURCE_ROOT, { recursive: true, encoding: "utf8" })
      .filter(file => file.endsWith(".ts") && !file.endsWith(".spec.ts") && !file.endsWith(".integration.ts"))
      .map(file => ({ file, content: readFileSync(path.join(SOURCE_ROOT, file), "utf8") }));
  }
});
