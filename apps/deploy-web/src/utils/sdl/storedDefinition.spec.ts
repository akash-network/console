import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import { hasSdlReference, isStoredSdlRedeployable, isStoredSdlSelfContained, leavesWithheldEnvValuesBlank, withEnvValuesFrom } from "./storedDefinition";

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

    it("is false when the withheld name was supplied and another service leaves its own same-named value blank", () => {
      expect(leavesWithheldEnvValuesBlank(sdlWithTwoServices(["TOKEN=given"], ["TOKEN="]), sdlWithTwoServices(["TOKEN="], ["TOKEN=given"]))).toBe(false);
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

  describe(isStoredSdlRedeployable.name, () => {
    it("accepts an sdl whose values are withheld as references, which configure resolves", () => {
      expect(isStoredSdlRedeployable('version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN=ac-secret://s0_e0"\n')).toBe(true);
    });

    it("accepts an sdl carrying real values", () => {
      expect(isStoredSdlRedeployable('version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN=abc"\n')).toBe(true);
    });

    it("rejects an sdl whose value was blanked away", () => {
      expect(isStoredSdlRedeployable('version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN="\n')).toBe(false);
    });

    it("rejects an sdl that does not parse", () => {
      expect(isStoredSdlRedeployable("services: [")).toBe(false);
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

    it("rejects an sdl whose blank value sits beside a real one", () => {
      expect(isStoredSdlSelfContained(sdlWithEnv(["TOKEN=", "REGION=us-east-1"]))).toBe(false);
    });

    it("rejects an sdl whose blank value sits in another service", () => {
      expect(isStoredSdlSelfContained(sdlWithTwoServices(["TOKEN=kept"], ["OTHER="]))).toBe(false);
    });

    it("accepts an sdl declaring only host-inherited env vars, which the api stores unredacted", () => {
      expect(isStoredSdlSelfContained(sdlWithEnv(["INHERITED_FROM_HOST"]))).toBe(true);
    });

    it("rejects an sdl that does not parse", () => {
      expect(isStoredSdlSelfContained("services: [unclosed")).toBe(false);
    });
  });

  describe(withEnvValuesFrom.name, () => {
    it("fills a withheld env value with the one this browser holds under the same name", () => {
      const restored = withEnvValuesFrom(sdlWithEnv(["TOKEN=from-this-browser"]), sdlWithEnv(["TOKEN=ac-secret://s0_e0", "MODE=dev"]));

      expect(envOf(restored, "web")).toEqual(["TOKEN=from-this-browser", "MODE=dev"]);
    });

    it("restores each service from its own values, since a name can mean something else in another service", () => {
      const restored = withEnvValuesFrom(
        sdlWithTwoServices(["TOKEN=web-token"], ["TOKEN=api-token"]),
        sdlWithTwoServices(["TOKEN=ac-secret://s0_e0"], ["TOKEN=ac-secret://s1_e0"])
      );

      expect(envOf(restored, "web")).toEqual(["TOKEN=web-token"]);
      expect(envOf(restored, "api")).toEqual(["TOKEN=api-token"]);
    });

    it("keeps a value carrying an equals sign whole", () => {
      const restored = withEnvValuesFrom(sdlWithEnv(["URL=postgres://u:p@h/db?a=1"]), sdlWithEnv(["URL=ac-secret://s0_e0"]));

      expect(envOf(restored, "web")).toEqual(["URL=postgres://u:p@h/db?a=1"]);
    });

    it("leaves the registry credentials withheld, since they are kept as secrets whatever this browser holds", () => {
      const restored = withEnvValuesFrom(
        `${sdlWithCredentials("a-plain-password")}\n    env:\n      - "TOKEN=from-this-browser"`,
        `${sdlWithCredentials("ac-secret://s0_c_password")}\n    env:\n      - "TOKEN=ac-secret://s0_e0"`
      );

      expect(envOf(restored, "web")).toEqual(["TOKEN=from-this-browser"]);
      expect(restored).toContain("ac-secret://s0_c_password");
      expect(restored).not.toContain("a-plain-password");
    });

    it("keeps a value withheld when this browser holds it as a reference too", () => {
      expect(withEnvValuesFrom(sdlWithEnv(["TOKEN=ac-secret://s0_e0"]), sdlWithEnv(["TOKEN=ac-secret://s0_e0"]))).toBeUndefined();
    });

    it("keeps a secret the user named withheld, even where this browser holds its value", () => {
      const restored = withEnvValuesFrom(
        sdlWithEnv(["DB_PASSWORD=sealed-by-the-user", "PORT=3000"]),
        sdlWithEnv(["DB_PASSWORD=ac-secret://DB_PASSWORD", "PORT=ac-secret://s0_e1"])
      );

      expect(envOf(restored, "web")).toEqual(["DB_PASSWORD=ac-secret://DB_PASSWORD", "PORT=3000"]);
    });

    it("keeps a value withheld when this browser holds nothing under its name", () => {
      expect(withEnvValuesFrom(sdlWithEnv(["OTHER=x"]), sdlWithEnv(["TOKEN=ac-secret://s0_e0"]))).toBeUndefined();
    });

    it("restores past a service that declares no env", () => {
      const withWorker = (webEnv: string) => `${sdlWithEnv([webEnv])}\n  worker:\n    image: busybox`;

      const restored = withEnvValuesFrom(withWorker("TOKEN=from-this-browser"), withWorker("TOKEN=ac-secret://s0_e0"));

      expect(envOf(restored, "web")).toEqual(["TOKEN=from-this-browser"]);
      expect(envOf(restored, "worker")).toBeUndefined();
    });

    it("is undefined when the api withholds no env value", () => {
      expect(withEnvValuesFrom(sdlWithEnv(["TOKEN=from-this-browser"]), sdlWithEnv(["TOKEN=from-the-api"]))).toBeUndefined();
    });

    it("is undefined when either copy does not parse", () => {
      expect(withEnvValuesFrom("services: [not, a, map", sdlWithEnv(["TOKEN=ac-secret://s0_e0"]))).toBeUndefined();
      expect(withEnvValuesFrom(sdlWithEnv(["TOKEN=x"]), "services: [not, a, map")).toBeUndefined();
    });
  });

  function envOf(sdl: string | undefined, service: string) {
    const document = yaml.load(sdl ?? "") as { services: Record<string, { env?: string[] }> };
    return document.services[service].env;
  }

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
