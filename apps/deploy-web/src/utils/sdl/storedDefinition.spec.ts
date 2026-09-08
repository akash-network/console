import { describe, expect, it } from "vitest";

import { hasOnlyBlankEnvValues, hasSdlReference, isStoredSdlSelfContained } from "./storedDefinition";

describe("storedDefinition", () => {
  describe(hasSdlReference.name, () => {
    it("is true for a secret reference in an env value", () => {
      expect(hasSdlReference(sdlWithEnv(["TOKEN=ac-secret://s0_e0"]))).toBe(true);
    });

    it("is true for a reference of a kind it does not recognize", () => {
      expect(hasSdlReference(sdlWithEnv(["TOKEN=ac-var://s0_e0"]))).toBe(true);
    });

    it("is true for a reference in a registry credential", () => {
      expect(hasSdlReference(sdlWithCredentials("ac-secret://s0_c_password"))).toBe(true);
    });

    it("is false for a value that merely contains the spelling", () => {
      expect(hasSdlReference(sdlWithEnv(["TOKEN=see ac-secret://s0_e0 for details"]))).toBe(false);
    });

    it("is false for a value the reference spelling only prefixes", () => {
      expect(hasSdlReference(sdlWithEnv(["TOKEN=ac-secret://s0_e0-suffixed"]))).toBe(false);
    });

    it("is false for an sdl carrying real values", () => {
      expect(hasSdlReference(sdlWithEnv(["TOKEN=a-real-token"]))).toBe(false);
    });

    it("is false for an sdl that does not parse", () => {
      expect(hasSdlReference("services: [unclosed")).toBe(false);
    });
  });

  describe(hasOnlyBlankEnvValues.name, () => {
    it("is true when every env entry across every service is empty", () => {
      expect(hasOnlyBlankEnvValues(sdlWithTwoServices(["TOKEN="], ["OTHER="]))).toBe(true);
    });

    it("does not treat a bare name as empty, because it inherits from the host environment", () => {
      expect(hasOnlyBlankEnvValues(sdlWithEnv(["TOKEN"]))).toBe(false);
    });

    it("is false when a blank entry sits beside a host-inherited one", () => {
      expect(hasOnlyBlankEnvValues(sdlWithEnv(["TOKEN=", "INHERITED_FROM_HOST"]))).toBe(false);
    });

    it("is false when one service still holds a value", () => {
      expect(hasOnlyBlankEnvValues(sdlWithTwoServices(["TOKEN="], ["OTHER=kept"]))).toBe(false);
    });

    it("is false when the sdl declares no env at all", () => {
      expect(hasOnlyBlankEnvValues(sdlWithoutEnv())).toBe(false);
    });

    it("is false for an sdl that does not parse", () => {
      expect(hasOnlyBlankEnvValues("services: [unclosed")).toBe(false);
    });
  });

  describe(isStoredSdlSelfContained.name, () => {
    it("accepts an sdl whose env values are all present", () => {
      expect(isStoredSdlSelfContained(sdlWithEnv(["TOKEN=a-real-token"]))).toBe(true);
    });

    it("accepts an sdl that declares no env at all", () => {
      expect(isStoredSdlSelfContained(sdlWithoutEnv())).toBe(true);
    });

    it("rejects an sdl whose values were withheld as references", () => {
      expect(isStoredSdlSelfContained(sdlWithEnv(["TOKEN=ac-secret://s0_e0"]))).toBe(false);
    });

    it("rejects an sdl whose env values are all blank", () => {
      expect(isStoredSdlSelfContained(sdlWithEnv(["TOKEN="]))).toBe(false);
    });

    it("accepts an sdl declaring only host-inherited env vars, which the api stores unredacted", () => {
      expect(isStoredSdlSelfContained(sdlWithEnv(["INHERITED_FROM_HOST"]))).toBe(true);
    });

    it("rejects an sdl that does not parse", () => {
      expect(isStoredSdlSelfContained("services: [unclosed")).toBe(false);
    });
  });

  function sdlWithEnv(env: string[]) {
    return ["version: '2.0'", "services:", "  web:", "    image: nginx", "    env:", ...env.map(entry => `      - "${entry}"`)].join("\n");
  }

  function sdlWithTwoServices(webEnv: string[], apiEnv: string[]) {
    return [
      "version: '2.0'",
      "services:",
      "  web:",
      "    image: nginx",
      "    env:",
      ...webEnv.map(entry => `      - "${entry}"`),
      "  api:",
      "    image: node",
      "    env:",
      ...apiEnv.map(entry => `      - "${entry}"`)
    ].join("\n");
  }

  function sdlWithoutEnv() {
    return ["version: '2.0'", "services:", "  web:", "    image: nginx"].join("\n");
  }

  function sdlWithCredentials(password: string) {
    return [
      "version: '2.0'",
      "services:",
      "  web:",
      "    image: nginx",
      "    credentials:",
      "      host: docker.io",
      "      username: someone",
      `      password: "${password}"`
    ].join("\n");
  }
});
