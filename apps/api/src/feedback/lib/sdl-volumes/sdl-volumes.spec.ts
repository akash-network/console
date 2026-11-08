import { describe, expect, it } from "vitest";

import { unmountableVolumesOf } from "./sdl-volumes";

import { ASSISTANT_TEST_SDL } from "@test/seeders/get-deployment-response.seeder";

describe(unmountableVolumesOf.name, () => {
  it("lists a mounted volume that declares no attributes", () => {
    expect(unmountableVolumesOf(sdlWithVolume([]))).toEqual(["web/data"]);
  });

  it("lists a mounted volume that is explicitly not persistent", () => {
    expect(unmountableVolumesOf(sdlWithVolume(["            attributes:", "              persistent: false"]))).toEqual(["web/data"]);
  });

  it.each([
    ["a persistent volume", ["            attributes:", "              persistent: true", "              class: beta3"]],
    ["a persistent volume given as a string", ["            attributes:", '              persistent: "true"']],
    ["a RAM volume", ["            attributes:", "              persistent: false", "              class: ram"]]
  ])("accepts %s", (_, attributeLines) => {
    expect(unmountableVolumesOf(sdlWithVolume(attributeLines))).toEqual([]);
  });

  it("reads the volumes of the compute profile the service deploys with", () => {
    const sdl = sdlWithVolume([]).replace("  compute:\n    web:", "  compute:\n    frontend:").replace("      profile: web", "      profile: frontend");

    expect(unmountableVolumesOf(sdl)).toEqual(["web/data"]);
  });

  it("ignores a service whose deployment names a compute profile the SDL lacks", () => {
    const sdl = sdlWithVolume([]).replace("      profile: web", "      profile: missing");

    expect(unmountableVolumesOf(sdl)).toEqual([]);
  });

  it("ignores a volume the service does not mount", () => {
    const sdl = sdlWithVolume([]).replace("    params:\n      storage:\n        data:\n          mount: /data\n", "");

    expect(unmountableVolumesOf(sdl)).toEqual([]);
  });

  it("ignores a mount of a volume no compute profile declares", () => {
    const sdl = ASSISTANT_TEST_SDL.replace("    expose:", "    params:\n      storage:\n        data:\n          mount: /data\n    expose:");

    expect(unmountableVolumesOf(sdl)).toEqual([]);
  });

  it("finds nothing in an SDL without mounts", () => {
    expect(unmountableVolumesOf(ASSISTANT_TEST_SDL)).toEqual([]);
  });

  it.each([
    ["does not parse as YAML", "services: [unclosed"],
    ["lacks the sections it reads", "version: '2.0'"]
  ])("finds nothing in an SDL that %s", (_, sdl) => {
    expect(unmountableVolumesOf(sdl)).toEqual([]);
  });

  function sdlWithVolume(attributeLines: string[]) {
    return ASSISTANT_TEST_SDL.replace("    expose:", "    params:\n      storage:\n        data:\n          mount: /data\n    expose:").replace(
      "        storage:\n          size: 2Gi",
      ["        storage:", "          - size: 2Gi", "          - name: data", "            size: 10Gi", ...attributeLines].join("\n")
    );
  }
});
