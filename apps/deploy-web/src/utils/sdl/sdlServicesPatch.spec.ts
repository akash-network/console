import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import { isEmptyServicesPatch, servicesPatchBetween } from "./sdlServicesPatch";

describe("sdlServicesPatch", () => {
  describe(servicesPatchBetween.name, () => {
    it("is empty for two identical SDLs", () => {
      const sdl = sdlWith({ web: { image: "nginx:1", env: ["PORT=80"] } });

      const patch = servicesPatchBetween(sdl, sdl);

      expect(patch).toEqual({});
      expect(isEmptyServicesPatch(patch)).toBe(true);
    });

    it("patches a changed image", () => {
      const patch = servicesPatchBetween(sdlWith({ web: { image: "nginx:1" } }), sdlWith({ web: { image: "nginx:2" } }));

      expect(patch).toEqual({ web: { image: "nginx:2" } });
    });

    it("patches added and changed env entries by name and removes the missing ones with null", () => {
      const previous = sdlWith({ web: { image: "nginx", env: ["PORT=80", "MODE=dev", "GONE=1"] } });
      const next = sdlWith({ web: { image: "nginx", env: ["PORT=80", "MODE=prod", "NEW=x"] } });

      expect(servicesPatchBetween(previous, next)).toEqual({ web: { env: { MODE: "prod", NEW: "x", GONE: null } } });
    });

    it("carries a secret reference as the patched value, so the api resolves it rather than a typed value", () => {
      const previous = sdlWith({ web: { image: "nginx", env: ["PORT=80"] } });
      const next = sdlWith({ web: { image: "nginx", env: ["PORT=80", "API_KEY=ac-secret://API_KEY"] } });

      expect(servicesPatchBetween(previous, next)).toEqual({ web: { env: { API_KEY: "ac-secret://API_KEY" } } });
    });

    it("splits an env entry on its first equals sign only", () => {
      const previous = sdlWith({ web: { image: "nginx", env: [] } });
      const next = sdlWith({ web: { image: "nginx", env: ["URL=postgres://u:p@h/db?a=1"] } });

      expect(servicesPatchBetween(previous, next)).toEqual({ web: { env: { URL: "postgres://u:p@h/db?a=1" } } });
    });

    it("leaves a bare env name alone, since it has no value a patch could carry", () => {
      const previous = sdlWith({ web: { image: "nginx", env: ["HOME"] } });
      const next = sdlWith({ web: { image: "nginx", env: ["HOME", "PORT=80"] } });

      expect(servicesPatchBetween(previous, next)).toEqual({ web: { env: { PORT: "80" } } });
    });

    it("patches a changed command and args, and clears one that was removed", () => {
      const previous = sdlWith({ web: { image: "nginx", command: ["sh"], args: ["-c", "run"] } });
      const next = sdlWith({ web: { image: "nginx", command: ["bash", "-l"] } });

      expect(servicesPatchBetween(previous, next)).toEqual({ web: { command: ["bash", "-l"], args: null } });
    });

    it("patches registry credentials whole when any field changes, and clears them when removed", () => {
      const withCredentials = { image: "nginx", credentials: { host: "ghcr.io", username: "alice", password: "ac-secret://REGISTRY_PASSWORD" } };
      const rotated = { image: "nginx", credentials: { host: "ghcr.io", username: "bob", password: "ac-secret://REGISTRY_PASSWORD" } };

      expect(servicesPatchBetween(sdlWith({ web: withCredentials }), sdlWith({ web: rotated }))).toEqual({
        web: { credentials: { host: "ghcr.io", username: "bob", password: "ac-secret://REGISTRY_PASSWORD" } }
      });
      expect(servicesPatchBetween(sdlWith({ web: withCredentials }), sdlWith({ web: { image: "nginx" } }))).toEqual({ web: { credentials: null } });
    });

    it("ignores a service only one side has, which is structural rather than patchable", () => {
      const previous = sdlWith({ web: { image: "nginx" }, old: { image: "redis" } });
      const next = sdlWith({ web: { image: "nginx" }, added: { image: "postgres" } });

      expect(servicesPatchBetween(previous, next)).toEqual({});
    });

    it("ignores fields outside the manifest-only set", () => {
      const previous = sdlWith({ web: { image: "nginx", expose: [{ port: 80, as: 80, to: [{ global: true }] }] } });
      const next = sdlWith({ web: { image: "nginx", expose: [{ port: 8080, as: 80, to: [{ global: true }] }] } });

      expect(servicesPatchBetween(previous, next)).toEqual({});
    });

    it("is empty when either SDL does not parse", () => {
      expect(servicesPatchBetween("not: [valid", sdlWith({ web: { image: "nginx" } }))).toEqual({});
      expect(servicesPatchBetween(sdlWith({ web: { image: "nginx" } }), "not: [valid")).toEqual({});
    });
  });

  function sdlWith(services: Record<string, Record<string, unknown>>): string {
    return yaml.dump({ version: "2.0", services });
  }
});
