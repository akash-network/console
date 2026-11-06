import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

import { withoutPlacementAttributes } from "./template-placement-attributes";

const AUDITOR = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";

const DART_SDL = `---
version: "2.0"

services:
  dart:
    image: google/dart-hello
    expose:
      - port: 8080
        as: 80
        to:
          - global: true

profiles:
  compute:
    dart:
      resources:
        cpu:
          units: 0.1
        memory:
          size: 512Mi
        storage:
          size: 512Mi
  placement:
    akash:
      attributes:
        host: akash
      signedBy:
        anyOf:
          - "${AUDITOR}"
      pricing:
        dart:
          denom: uact
          amount: 10000

deployment:
  dart:
    akash:
      profile: dart
      count: 1
`;

describe(withoutPlacementAttributes.name, () => {
  it("removes the template's host attribute and keeps pricing and signedBy exactly as written", () => {
    const sdl = withoutPlacementAttributes(DART_SDL);

    expect(placementsOf(sdl)).toEqual({
      akash: { signedBy: { anyOf: [AUDITOR] }, pricing: { dart: { denom: "uact", amount: 10000 } } }
    });
  });

  it("leaves everything outside the placement attributes unchanged", () => {
    const original = load(DART_SDL) as Sdl;
    delete original.profiles.placement.akash.attributes;

    expect(load(withoutPlacementAttributes(DART_SDL))).toEqual(original);
  });

  it("removes the attributes of every placement profile", () => {
    const secondPlacement = [
      "    westcoast:",
      "      attributes:",
      "        organization: akash.network",
      "        ip-lease: true",
      "      pricing:",
      "        dart:",
      "          denom: uakt",
      "          amount: 100"
    ];
    const sdl = withoutPlacementAttributes(DART_SDL.replace("\ndeployment:", `${secondPlacement.join("\n")}\n\ndeployment:`));

    expect(placementsOf(sdl)).toEqual({
      akash: { signedBy: { anyOf: [AUDITOR] }, pricing: { dart: { denom: "uact", amount: 10000 } } },
      westcoast: { pricing: { dart: { denom: "uakt", amount: 100 } } }
    });
  });

  it("keeps resource attributes such as the GPU vendor and storage class", () => {
    const sdl = withoutPlacementAttributes(
      DART_SDL.replace(
        "        storage:\n          size: 512Mi",
        [
          "        gpu:",
          "          units: 1",
          "          attributes:",
          "            vendor:",
          "              nvidia:",
          "                - model: a100",
          "        storage:",
          "          - size: 512Mi",
          "          - name: data",
          "            size: 10Gi",
          "            attributes:",
          "              persistent: true",
          "              class: beta3"
        ].join("\n")
      )
    );

    expect((load(sdl) as Sdl).profiles.compute.dart.resources).toMatchObject({
      gpu: { attributes: { vendor: { nvidia: [{ model: "a100" }] } } },
      storage: [{ size: "512Mi" }, { name: "data", attributes: { persistent: true, class: "beta3" } }]
    });
  });

  it("keeps long values on a single line", () => {
    const longCommand = `echo ${"a".repeat(120)} && echo ${"b".repeat(120)}`;

    const sdl = withoutPlacementAttributes(DART_SDL.replace("    image: google/dart-hello", `    image: google/dart-hello\n    command: "${longCommand}"`));

    expect(sdl).toContain(`command: ${longCommand}\n`);
  });

  it("returns an SDL without placement attributes as the same text, comments included", () => {
    const sdl = `# keep me\n${DART_SDL.replace("      attributes:\n        host: akash\n", "")}`;

    expect(withoutPlacementAttributes(sdl)).toBe(sdl);
  });

  it("returns an SDL whose placement section holds no profiles as the same text", () => {
    const sdl = "version: '2.0'\nprofiles:\n  placement:\n    akash: null\n    other: [attributes]\n    scalar: attributes\n";

    expect(withoutPlacementAttributes(sdl)).toBe(sdl);
  });

  it("returns an SDL without a placement section as the same text", () => {
    expect(withoutPlacementAttributes("version: '2.0'\nprofiles: compute\n")).toBe("version: '2.0'\nprofiles: compute\n");
    expect(withoutPlacementAttributes("- attributes\n")).toBe("- attributes\n");
  });

  it("returns text it cannot parse unchanged", () => {
    const sdl = "profiles:\n  placement: [unclosed\n";

    expect(withoutPlacementAttributes(sdl)).toBe(sdl);
  });

  type Sdl = {
    profiles: {
      compute: Record<string, { resources: Record<string, unknown> }>;
      placement: Record<string, Record<string, unknown>>;
    };
  };

  function placementsOf(sdl: string) {
    return (load(sdl) as Sdl).profiles.placement;
  }
});
