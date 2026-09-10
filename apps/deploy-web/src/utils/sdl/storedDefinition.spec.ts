import { describe, expect, it } from "vitest";

import { hasSdlReference, isStoredSdlSelfContained, leavesWithheldEnvValuesBlank } from "./storedDefinition";

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

  describe(leavesWithheldEnvValuesBlank.name, () => {
    it("is true when a key the api blanked is still blank", () => {
      expect(leavesWithheldEnvValuesBlank(sdlWithEnv(["TOKEN="]), sdlWithEnv(["TOKEN="]))).toBe(true);
    });

    it("is true when only some of the keys the api blanked have been filled in", () => {
      expect(leavesWithheldEnvValuesBlank(sdlWithEnv(["TOKEN=given", "OTHER="]), sdlWithEnv(["TOKEN=", "OTHER="]))).toBe(true);
    });

    it("is true when a key the api blanked in another service is still blank", () => {
      expect(leavesWithheldEnvValuesBlank(sdlWithTwoServices(["TOKEN=given"], ["OTHER="]), sdlWithTwoServices(["TOKEN="], ["OTHER="]))).toBe(true);
    });

    it("is false once every key the api blanked has been given a value", () => {
      expect(leavesWithheldEnvValuesBlank(sdlWithEnv(["TOKEN=given", "OTHER=given"]), sdlWithEnv(["TOKEN=", "OTHER="]))).toBe(false);
    });

    it("is false for a blank key of the user's own that the api's record never held", () => {
      expect(leavesWithheldEnvValuesBlank(sdlWithEnv(["OPTIONAL="]), sdlWithEnv(["TOKEN=given"]))).toBe(false);
    });

    it("is false when the api's record blanked nothing", () => {
      expect(leavesWithheldEnvValuesBlank(sdlWithEnv(["TOKEN="]), sdlWithoutEnv())).toBe(false);
    });

    it("does not treat a bare name as blank, because it inherits from the host environment", () => {
      expect(leavesWithheldEnvValuesBlank(sdlWithEnv(["TOKEN"]), sdlWithEnv(["TOKEN"]))).toBe(false);
    });

    it("is false when the edited sdl does not parse", () => {
      expect(leavesWithheldEnvValuesBlank("services: [unclosed", sdlWithEnv(["TOKEN="]))).toBe(false);
    });

    it("is false when the api's record does not parse", () => {
      expect(leavesWithheldEnvValuesBlank(sdlWithEnv(["TOKEN="]), "services: [unclosed")).toBe(false);
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
