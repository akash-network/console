import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import { helloWorldTemplate } from "./templates";

describe("helloWorldTemplate", () => {
  it("runs the hello world image published on port 80 from the port its app listens on", () => {
    const sdl = yaml.load(helloWorldTemplate.content) as { services: { web: { image: string; expose: { port: number; as: number }[] } } };

    expect(sdl.services.web.image).toBe("ghcr.io/akash-network/hello-akash-world:2.1.0");
    expect(sdl.services.web.expose).toEqual([expect.objectContaining({ port: 3000, as: 80 })]);
  });
});
