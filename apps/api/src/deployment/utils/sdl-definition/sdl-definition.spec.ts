import { describe, expect, it } from "vitest";

import { definitionOf } from "./sdl-definition";

describe(definitionOf.name, () => {
  it("reads a stored sdl as the document it describes", () => {
    const sdl = ['version: "2.0"', "services:", "  web:", "    image: nginx", "    env:", "      - API_KEY=ac-secret://API_KEY", ""].join("\n");

    expect(definitionOf(sdl)).toEqual({ version: "2.0", services: { web: { image: "nginx", env: ["API_KEY=ac-secret://API_KEY"] } } });
  });

  it("answers null for a stored sdl that is not a document", () => {
    expect(definitionOf("services: [")).toBeNull();
  });
});
