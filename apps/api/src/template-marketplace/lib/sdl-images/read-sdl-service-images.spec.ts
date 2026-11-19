import { describe, expect, it } from "vitest";

import { isMapping, readSdlServiceImages, readSdlServices } from "./read-sdl-service-images";

describe(readSdlServiceImages.name, () => {
  it("reads the image of each service as written, without the white space around it", () => {
    const sdl = "services:\n  web:\n    image: '  ghcr.io/acme/web:1  '\n  db:\n    image: postgres:16\n";

    expect(readSdlServiceImages(sdl)).toEqual([
      { service: "web", image: "ghcr.io/acme/web:1" },
      { service: "db", image: "postgres:16" }
    ]);
  });

  it("skips a service that is not a mapping or names no image", () => {
    const sdl = JSON.stringify({ services: { list: ["image"], none: {}, blank: { image: "  " }, number: { image: 16 }, web: { image: "acme/web" } } });

    expect(readSdlServiceImages(sdl)).toEqual([{ service: "web", image: "acme/web" }]);
  });

  it.each(["services: [", "", "just text", "- a\n- b", "services: 4", "services:\n  - web"])("reads nothing from %j", sdl => {
    expect(readSdlServiceImages(sdl)).toEqual([]);
  });
});

describe(readSdlServices.name, () => {
  it("reads the services mapping of an SDL", () => {
    expect(readSdlServices("services:\n  web:\n    image: nginx:1\n")).toEqual({ web: { image: "nginx:1" } });
  });

  it("reads no service from a document that is not a mapping", () => {
    expect(readSdlServices("- services")).toEqual({});
  });
});

describe(isMapping.name, () => {
  it.each([
    { value: {}, expected: true },
    { value: { a: 1 }, expected: true },
    { value: [], expected: false },
    { value: null, expected: false },
    { value: "text", expected: false },
    { value: 3, expected: false },
    { value: undefined, expected: false }
  ])("answers $expected for $value", ({ value, expected }) => {
    expect(isMapping(value)).toBe(expected);
  });
});
