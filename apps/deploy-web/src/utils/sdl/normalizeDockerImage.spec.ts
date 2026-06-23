import { describe, expect, it } from "vitest";

import { normalizeDockerImage } from "./normalizeDockerImage";

describe("normalizeDockerImage", () => {
  it("lowercases the repository while preserving the tag case", () => {
    expect(normalizeDockerImage("ghcr.io/Your-Org/App:Latest-RC1")).toBe("ghcr.io/your-org/app:Latest-RC1");
  });

  it("lowercases a tagless image reference entirely", () => {
    expect(normalizeDockerImage("My-Org/NGINX")).toBe("my-org/nginx");
  });

  it("does not treat a host:port registry prefix as a tag", () => {
    expect(normalizeDockerImage("MyRegistry.example.com:5000/Repo")).toBe("myregistry.example.com:5000/repo");
  });

  it("lowercases the repository while preserving a digest", () => {
    expect(normalizeDockerImage("Repo@sha256:ABCdef")).toBe("repo@sha256:ABCdef");
  });

  it("returns an empty string unchanged", () => {
    expect(normalizeDockerImage("")).toBe("");
  });
});
