import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SdlSecretsKmsClient } from "./kms.provider";
import { createSdlSecretsKmsTarget } from "./kms.provider";

describe(createSdlSecretsKmsTarget.name, () => {
  it("names the configured version as the write target", () => {
    const { target } = setup({ version: "2" });

    expect(target.versionName).toBe(versionPath("2"));
    expect(target.kid).toBe("sdl-secrets.v2");
  });

  it("resolves an older version of the same crypto key while a newer one is configured", () => {
    const { target } = setup({ version: "2" });

    expect(target.resolveVersionName("sdl-secrets.v1")).toBe(versionPath("1"));
  });

  it("resolves a version far above the configured one, because which versions exist is the key service's answer", () => {
    const { target } = setup({ version: "2" });

    expect(target.resolveVersionName("sdl-secrets.v9")).toBe(versionPath("9"));
  });

  it("resolves the configured version itself", () => {
    const { target } = setup({ version: "2" });

    expect(target.resolveVersionName(target.kid)).toBe(target.versionName);
  });

  it.each([
    ["a foreign crypto key", "other-key.v1"],
    ["a crypto key the alias only prefixes", "sdl-secrets-old.v1"],
    ["a crypto key the alias only suffixes", "not-sdl-secrets.v1"],
    ["no version at all", "sdl-secrets"],
    ["an empty version", "sdl-secrets.v"],
    ["version zero", "sdl-secrets.v0"],
    ["a leading zero", "sdl-secrets.v01"],
    ["a non-numeric version", "sdl-secrets.vx"],
    ["a negative version", "sdl-secrets.v-1"],
    ["a fractional version", "sdl-secrets.v1.5"],
    ["a version with trailing content", "sdl-secrets.v1x"],
    ["a version longer than any Cloud KMS assigns", `sdl-secrets.v${"9".repeat(11)}`],
    ["a traversal in place of a version", "sdl-secrets.v1/../../2"],
    ["a whole resource name", versionPath("1")]
  ])("refuses %s", (_, kid) => {
    const { target } = setup();

    expect(target.resolveVersionName(kid)).toBeUndefined();
  });

  it.each([
    ["a missing kid", undefined],
    ["a null kid", null],
    ["a numeric kid", 1],
    ["an object kid", { kid: "sdl-secrets.v1" }]
  ])("refuses %s", (_, kid) => {
    const { target } = setup();

    expect(target.resolveVersionName(kid)).toBeUndefined();
  });

  function versionPath(version: string) {
    return `projects/console-test/locations/global/keyRings/console-api/cryptoKeys/sdl-secrets/cryptoKeyVersions/${version}`;
  }

  function setup(input?: { version?: string }) {
    const client = mock<SdlSecretsKmsClient>();
    const target = createSdlSecretsKmsTarget({ client, versionPath, key: "sdl-secrets", version: input?.version ?? "1" });

    return { target, client };
  }
});
