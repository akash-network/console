import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolvePathWithinDir } from "./path";

describe(resolvePathWithinDir.name, () => {
  const baseDir = "/data/templates/v1/templates";

  it.each([
    "akash-network-awesome-akash-openclaw.json",
    "akash-network-awesome-akash-DeepSeek-V3.1.json", // legit ids can contain dots
    "with spaces.json", // legit folder names can contain spaces
    "./openclaw.json" // a leading ./ stays in-dir
  ])("returns the resolved absolute path for in-dir segment %s", segment => {
    expect(resolvePathWithinDir(baseDir, segment)).toBe(path.resolve(baseDir, segment));
  });

  it.each([
    "../../etc/passwd.json", // parent traversal
    "../secret.json",
    "../../../../../../etc/passwd.json",
    "/etc/passwd.json", // absolute escape
    "subdir/../../escape.json", // traversal after a nested segment
    "..", // resolves to the parent dir
    ".", // resolves to the base dir itself
    "with\0null.json" // null byte
  ])("returns null for traversal, escape, or null-byte segment %s", segment => {
    expect(resolvePathWithinDir(baseDir, segment)).toBeNull();
  });

  it("resolves the base dir relative to cwd when given a relative base", () => {
    const result = resolvePathWithinDir("./dist/.data/templates/v1/templates", "openclaw.json");

    expect(result).toBe(path.resolve("./dist/.data/templates/v1/templates", "openclaw.json"));
    expect(path.isAbsolute(result!)).toBe(true);
  });
});
