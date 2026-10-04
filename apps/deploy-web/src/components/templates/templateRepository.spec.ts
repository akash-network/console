import { describe, expect, it } from "vitest";

import { describeRepository } from "./templateRepository";

describe(describeRepository.name, () => {
  it("names the repository and the folder a file view points at", () => {
    expect(describeRepository("https://github.com/akash-network/awesome-akash/blob/9f6f7991c346a91d2a8835d68fa3230c4a187eb4/comfyui")).toBe(
      "akash-network/awesome-akash/comfyui"
    );
  });

  it("names the nested folder a tree view points at", () => {
    expect(describeRepository("https://github.com/akash-network/awesome-akash/tree/main/ai/llama")).toBe("akash-network/awesome-akash/ai/llama");
  });

  it("names only the repository for a repository link", () => {
    expect(describeRepository("https://github.com/akash-network/hello-akash-world/")).toBe("akash-network/hello-akash-world");
  });

  it("names only the repository for a link to another repository page", () => {
    expect(describeRepository("https://github.com/akash-network/console/pull/735/files")).toBe("akash-network/console");
  });

  it("returns nothing for a link that names no repository", () => {
    expect(describeRepository("https://github.com/akash-network")).toBeUndefined();
  });

  it("returns nothing for a value that is not a link", () => {
    expect(describeRepository("not a url")).toBeUndefined();
  });

  it("returns nothing without a link", () => {
    expect(describeRepository(undefined)).toBeUndefined();
    expect(describeRepository("")).toBeUndefined();
  });
});
