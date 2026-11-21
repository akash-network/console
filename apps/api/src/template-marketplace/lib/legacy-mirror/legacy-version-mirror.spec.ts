import { describe, expect, it } from "vitest";

import { legacyHardwareOf, legacyMirrorOf } from "./legacy-version-mirror";

const SDL = [
  "version: '2.0'",
  "services:",
  "  web:",
  "    image: nginx:1.27",
  "profiles:",
  "  compute:",
  "    web:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          size: 1Gi",
  "  placement:",
  "    dcloud:",
  "      pricing:",
  "        web:",
  "          denom: uakt",
  "          amount: 1000",
  "deployment:",
  "  web:",
  "    dcloud:",
  "      profile: web",
  "      count: 1"
].join("\n");

describe(legacyHardwareOf.name, () => {
  it("turns cpu units into millicpu and keeps bytes", () => {
    expect(legacyHardwareOf({ cpu: 1.5, memoryBytes: 2048, storageBytes: 4096 })).toEqual({ cpu: 1500, ram: 2048, storage: 4096 });
  });

  it("rounds a fraction of a millicpu", () => {
    expect(legacyHardwareOf({ cpu: 0.0014, memoryBytes: 1, storageBytes: 1 }).cpu).toBe(1);
  });

  it.each([null, undefined])("answers zeros for %s", hardware => {
    expect(legacyHardwareOf(hardware)).toEqual({ cpu: 0, ram: 0, storage: 0 });
  });
});

describe(legacyMirrorOf.name, () => {
  it("mirrors the SDL and the resources the version recorded", () => {
    const mirror = legacyMirrorOf({ sdl: SDL, resources: { cpu: 2, memoryBytes: 10, storageBytes: 20 } });

    expect(mirror).toEqual({ sdl: SDL, cpu: 2000, ram: 10, storage: 20 });
  });

  it("reads the resources from the SDL of a version that recorded none", () => {
    expect(legacyMirrorOf({ sdl: SDL, resources: null })).toEqual({ sdl: SDL, cpu: 500, ram: 512 * 1024 * 1024, storage: 1024 * 1024 * 1024 });
  });

  it("answers zeros for a version whose SDL names no resources", () => {
    expect(legacyMirrorOf({ sdl: "version: '2.0'", resources: null })).toEqual({ sdl: "version: '2.0'", cpu: 0, ram: 0, storage: 0 });
  });
});
