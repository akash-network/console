import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

import { withoutPlacementAttributes } from "./template-placement-attributes";

const AUDITOR = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";

const HOST_ATTRIBUTE_LINES = "      attributes:\n        host: akash\n";

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
${HOST_ATTRIBUTE_LINES}      signedBy:
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

  it("removes only the attribute lines, keeping comments, quotes and blank lines as the author wrote them", () => {
    const commentedSdl = DART_SDL.replace("services:", "# Runs the Dart hello world sample\nservices:")
      .replace("    image: google/dart-hello", "    image: 'google/dart-hello' # pinned by the template")
      .replace("    akash:\n", "    # audited hosts only\n    akash:\n")
      .replace("        host: akash\n", "        host: akash # gallery default\n");

    expect(withoutPlacementAttributes(commentedSdl)).toBe(commentedSdl.replace("      attributes:\n        host: akash # gallery default\n", ""));
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
    const sdl = DART_SDL.replace("\ndeployment:", `${secondPlacement.join("\n")}\n\ndeployment:`);

    expect(withoutPlacementAttributes(sdl)).toBe(
      sdl.replace(HOST_ATTRIBUTE_LINES, "").replace("      attributes:\n        organization: akash.network\n        ip-lease: true\n", "")
    );
  });

  it("removes an attributes key left empty", () => {
    const sdl = DART_SDL.replace(HOST_ATTRIBUTE_LINES, "      attributes:\n");

    expect(withoutPlacementAttributes(sdl)).toBe(DART_SDL.replace(HOST_ATTRIBUTE_LINES, ""));
  });

  it("removes an explicit attributes key that has no value", () => {
    const sdl = DART_SDL.replace(HOST_ATTRIBUTE_LINES, "      ? attributes\n");

    expect(withoutPlacementAttributes(sdl)).toBe(DART_SDL.replace(HOST_ATTRIBUTE_LINES, ""));
  });

  it("removes attributes that end the document without a trailing newline", () => {
    const sdl =
      "version: '2.0'\nprofiles:\n  placement:\n    akash:\n      pricing:\n        dart:\n          denom: uact\n          amount: 1\n      attributes:\n        host: akash";

    expect(withoutPlacementAttributes(sdl)).toBe(
      "version: '2.0'\nprofiles:\n  placement:\n    akash:\n      pricing:\n        dart:\n          denom: uact\n          amount: 1\n"
    );
  });

  it("keeps Windows line endings", () => {
    const sdl = DART_SDL.replaceAll("\n", "\r\n");

    expect(withoutPlacementAttributes(sdl)).toBe(DART_SDL.replace(HOST_ATTRIBUTE_LINES, "").replaceAll("\n", "\r\n"));
  });

  it("removes attributes written inline in a flow style profile and keeps the comments and long lines of the rest of the document", () => {
    const longCommand = `echo ${"a".repeat(120)} && echo ${"b".repeat(120)}`;
    const blockProfile = [
      "    westcoast:",
      "      attributes:",
      "        host: akash",
      "      pricing:",
      "        dart:",
      "          denom: uakt",
      "          amount: 100"
    ];
    const sdl = DART_SDL.replace("    image: google/dart-hello", `    image: google/dart-hello\n    command: "${longCommand}"`).replace(
      `    akash:\n${HOST_ATTRIBUTE_LINES}      signedBy:\n        anyOf:\n          - "${AUDITOR}"\n      pricing:\n        dart:\n          denom: uact\n          amount: 10000\n`,
      `    # audited hosts only\n    akash: { attributes: { host: akash }, signedBy: { anyOf: ["${AUDITOR}"] }, pricing: { dart: { denom: uact, amount: 10000 } } }\n${blockProfile.join("\n")}\n`
    );

    const stripped = withoutPlacementAttributes(sdl);

    expect(placementsOf(stripped)).toEqual({
      akash: { signedBy: { anyOf: [AUDITOR] }, pricing: { dart: { denom: "uact", amount: 10000 } } },
      westcoast: { pricing: { dart: { denom: "uakt", amount: 100 } } }
    });
    expect(stripped).toContain("# audited hosts only\n");
    expect(stripped).toContain(`command: "${longCommand}"\n`);
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

  it("returns an SDL without placement attributes as the same text, comments included", () => {
    const sdl = `# keep me\n${DART_SDL.replace(HOST_ATTRIBUTE_LINES, "")}`;

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

  it("returns an SDL with a parse error unchanged even when it sets placement attributes", () => {
    const sdl = `${DART_SDL}deployment:\n  other: {}\n`;

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
