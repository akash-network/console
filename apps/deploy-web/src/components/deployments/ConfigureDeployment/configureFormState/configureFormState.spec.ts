import { describe, expect, it } from "vitest";

import { SSH_VM_IMAGES } from "@src/utils/sdl/data";
import { HELLO_WORLD_IMAGE } from "@src/utils/templates";
import { draftableSdlOf, getInitialState, regenerateSdl } from "./configureFormState";

const WEB_SDL = `version: "2.0"
services:
  web:
    image: nginx:1.27
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 1
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

const SECRET_SDL = WEB_SDL.replace("    image: nginx:1.27\n", "    image: nginx:1.27\n    env:\n      - API_KEY=ac-secret://API_KEY\n");

describe("configureFormState", () => {
  describe(getInitialState.name, () => {
    it("imports a carried-in SDL and selects its first service", () => {
      const state = getInitialState(WEB_SDL, { vm: false });

      expect(state.values.services.map(service => service.title)).toEqual(["web"]);
      expect(state.values.services[0].image).toBe("nginx:1.27");
      expect(state.selectedServiceId).toBe(state.values.services[0].id);
      expect(state.sdl).toContain("image: nginx:1.27");
      expect(state.importError).toBeUndefined();
    });

    it("starts a blank default deployment without an SDL", () => {
      const state = getInitialState(undefined, { vm: false });

      expect(state.values.services).toHaveLength(1);
      expect(state.values.services[0].image).not.toBe(HELLO_WORLD_IMAGE);
      expect(state.values.hasSSHKey).toBeFalsy();
      expect(state.changes).toEqual([]);
      expect(state.importError).toBeUndefined();
      expect(state.sdl).toContain('version: "2.0"');
    });

    it("seeds an ssh ready vm on a vm entry", () => {
      const state = getInitialState(undefined, { vm: true });

      expect(state.values.services[0].image).toBe(SSH_VM_IMAGES["Ubuntu 24.04"]);
      expect(state.values.hasSSHKey).toBe(true);
    });

    it("seeds the example image on an example image entry", () => {
      const state = getInitialState(undefined, { vm: false, exampleImage: true });

      expect(state.values.services[0].image).toBe(HELLO_WORLD_IMAGE);
    });

    it("seeds the default hardware preset", () => {
      const state = getInitialState(undefined, { vm: false });

      expect(state.values.services[0].profile.cpu).toBeGreaterThan(0);
    });

    it("falls back to the default deployment with a message when the SDL is invalid", () => {
      const state = getInitialState("services: [: nope", { vm: false });

      expect(state.values.services).toHaveLength(1);
      expect(state.importError).toBe("The deployment couldn't be loaded because its SDL is invalid.");
    });

    it("falls back to the default deployment without a message when the SDL has no service", () => {
      const state = getInitialState('version: "2.0"\nservices: {}\n', { vm: false });

      expect(state.values.services).toHaveLength(1);
      expect(state.importError).toBeUndefined();
    });

    it("restores the regions a draft kept beside its SDL", () => {
      const state = getInitialState(WEB_SDL, { vm: false }, { dcloud: ["us-east", "eu-west"] });

      expect(state.values.placements[0].regions).toEqual(["us-east", "eu-west"]);
    });

    it("keeps a placement's own regions when the draft kept none for it", () => {
      const state = getInitialState(WEB_SDL, { vm: false }, { other: ["us-east"] });

      expect(state.values.placements[0].regions).toEqual(getInitialState(WEB_SDL, { vm: false }).values.placements[0].regions);
    });
  });

  describe(regenerateSdl.name, () => {
    it("writes a typed secret as a reference", () => {
      const { values } = getInitialState(WEB_SDL, { vm: false });
      values.services[0].env = [{ id: "e1", key: "API_KEY", value: "typed-secret-value", isSecret: true }];

      const sdl = regenerateSdl(values, "");

      expect(sdl).toContain("API_KEY=ac-secret://API_KEY");
      expect(sdl).not.toContain("typed-secret-value");
    });

    it("keeps the previous SDL while the values cannot be generated", () => {
      const { values } = getInitialState(WEB_SDL, { vm: false });

      expect(regenerateSdl({ ...values, services: undefined as never }, "previous")).toBe("previous");
    });
  });

  describe(draftableSdlOf.name, () => {
    it("seals the starting SDL like the working one", () => {
      const { values } = getInitialState(SECRET_SDL, { vm: false });

      expect(draftableSdlOf(SECRET_SDL, values.services)).toContain("API_KEY=ac-secret://API_KEY");
    });

    it("drops a starting SDL that no longer imports", () => {
      expect(draftableSdlOf("services: [: nope", [])).toBeUndefined();
    });
  });
});
