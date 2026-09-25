import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import { importableServicesOf, recordableDefinitionOf, secretVariableKey, suggestedSecretVariablesOf } from "./recordableDefinition";

const SDL = `version: "2.0"
services:
  web:
    image: ghcr.io/acme/web:1.2.0
    env:
      - DATABASE_PASSWORD=hunter2hunter2
      - LOG_LEVEL=debug
      - SSH_HOST_KEY
    credentials:
      host: ghcr.io
      username: acme-bot
      password: registry-password
    expose:
      - port: 80
        as: 80
        to:
          - global: true
  worker:
    image: busybox:1.36
    env:
      - API_TOKEN=ac-secret://API_TOKEN
      - MY-VAR.NAME=some-value
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 1Gi
    worker:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 1Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
        worker:
          denom: uakt
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
  worker:
    dcloud:
      profile: worker
      count: 1
`;

const SDL_WITHOUT_SECRETS = `version: "2.0"
services:
  web:
    image: nginx:1.25
    env:
      - LOG_LEVEL=debug
`;

const SDL_SHARING_AN_ENV_LIST = `version: "2.0"
services:
  web:
    image: nginx:1.25
    env: &shared
      - DATABASE_URL=postgres://db
  worker:
    image: nginx:1.25
    env: *shared
`;

describe("recordableDefinition", () => {
  describe(importableServicesOf.name, () => {
    it("lists each service's variables by name, with the name of any reference one already carries", () => {
      expect(importableServicesOf(SDL)).toEqual([
        {
          name: "web",
          image: "ghcr.io/acme/web:1.2.0",
          variables: [
            { key: "DATABASE_PASSWORD", referenceName: null },
            { key: "LOG_LEVEL", referenceName: null }
          ],
          hasCredentials: true
        },
        {
          name: "worker",
          image: "busybox:1.36",
          variables: [
            { key: "API_TOKEN", referenceName: "API_TOKEN" },
            { key: "MY-VAR.NAME", referenceName: null }
          ],
          hasCredentials: false
        }
      ]);
    });

    it("lists nothing for a document that is not yaml", () => {
      expect(importableServicesOf("services: [not, a, map")).toEqual([]);
    });
  });

  describe(suggestedSecretVariablesOf.name, () => {
    it("suggests the variables whose names look like they hold a secret", () => {
      expect(suggestedSecretVariablesOf(importableServicesOf(SDL))).toEqual(new Set([secretVariableKey("web", "DATABASE_PASSWORD")]));
    });
  });

  describe(recordableDefinitionOf.name, () => {
    it("hands back the sdl verbatim when nothing in it is to be sealed", () => {
      const result = recordableDefinitionOf(SDL_WITHOUT_SECRETS, { secretVariables: new Set(), referenceValues: {} });

      expect(result).toEqual({ sdl: SDL_WITHOUT_SECRETS, secrets: {} });
    });

    it("stands a reference in for each variable marked secret and hands its value back under that name", () => {
      const result = recordableDefinitionOf(SDL, { secretVariables: new Set([secretVariableKey("web", "DATABASE_PASSWORD")]), referenceValues: {} });

      expect(envOf(result.sdl, "web")).toContain("DATABASE_PASSWORD=ac-secret://DATABASE_PASSWORD");
      expect(result.secrets).toMatchObject({ DATABASE_PASSWORD: "hunter2hunter2" });
      expect(result.sdl).not.toContain("hunter2hunter2");
    });

    it("leaves a variable that is not marked, and one inheriting from the host, as they were", () => {
      const result = recordableDefinitionOf(SDL, { secretVariables: new Set([secretVariableKey("web", "DATABASE_PASSWORD")]), referenceValues: {} });

      expect(envOf(result.sdl, "web")).toEqual(expect.arrayContaining(["LOG_LEVEL=debug", "SSH_HOST_KEY"]));
    });

    it("seals registry credentials typed in the clear, whatever is marked", () => {
      const result = recordableDefinitionOf(SDL, { secretVariables: new Set(), referenceValues: {} });

      expect(servicesOf(result.sdl).web.credentials).toEqual({
        host: "ghcr.io",
        username: "ac-secret://REGISTRY_USERNAME",
        password: "ac-secret://REGISTRY_PASSWORD"
      });
      expect(result.secrets).toEqual({ REGISTRY_USERNAME: "acme-bot", REGISTRY_PASSWORD: "registry-password" });
    });

    it("mints a name no reference in the sdl already stands on", () => {
      const result = recordableDefinitionOf(SDL.replace("LOG_LEVEL=debug", "API_TOKEN=plain-token"), {
        secretVariables: new Set([secretVariableKey("web", "API_TOKEN")]),
        referenceValues: {}
      });

      expect(envOf(result.sdl, "web")).toContain("API_TOKEN=ac-secret://API_TOKEN_2");
      expect(result.secrets).toMatchObject({ API_TOKEN_2: "plain-token" });
    });

    it("derives a valid secret name from a variable name a secret name cannot spell", () => {
      const result = recordableDefinitionOf(SDL, { secretVariables: new Set([secretVariableKey("worker", "MY-VAR.NAME")]), referenceValues: {} });

      expect(envOf(result.sdl, "worker")).toContain("MY-VAR.NAME=ac-secret://MY_VAR_NAME");
      expect(result.secrets).toMatchObject({ MY_VAR_NAME: "some-value" });
    });

    it("keeps a reference the sdl already carries and hands back the value given for it", () => {
      const result = recordableDefinitionOf(SDL, { secretVariables: new Set(), referenceValues: { API_TOKEN: "token-value" } });

      expect(envOf(result.sdl, "worker")).toContain("API_TOKEN=ac-secret://API_TOKEN");
      expect(result.secrets).toMatchObject({ API_TOKEN: "token-value" });
    });

    it("seals a variable two services share through an anchor once, for both", () => {
      const result = recordableDefinitionOf(SDL_SHARING_AN_ENV_LIST, {
        secretVariables: new Set([secretVariableKey("web", "DATABASE_URL")]),
        referenceValues: {}
      });

      expect(envOf(result.sdl, "web")).toEqual(["DATABASE_URL=ac-secret://DATABASE_URL"]);
      expect(envOf(result.sdl, "worker")).toEqual(["DATABASE_URL=ac-secret://DATABASE_URL"]);
      expect(result.secrets).toEqual({ DATABASE_URL: "postgres://db" });
    });

    it("resolves back to the very document it was given, so the version it hashes to is unchanged", () => {
      const result = recordableDefinitionOf(SDL, {
        secretVariables: new Set([secretVariableKey("web", "DATABASE_PASSWORD"), secretVariableKey("worker", "MY-VAR.NAME")]),
        referenceValues: { API_TOKEN: "token-value" }
      });

      expect(resolved(result.sdl, result.secrets)).toEqual(resolved(SDL, { API_TOKEN: "token-value" }));
    });
  });

  function servicesOf(sdl: string) {
    return (yaml.load(sdl) as { services: Record<string, { env?: string[]; credentials?: Record<string, string> }> }).services;
  }

  function envOf(sdl: string, service: string) {
    return servicesOf(sdl)[service].env ?? [];
  }

  function resolved(sdl: string, secrets: Record<string, string>) {
    const document = yaml.load(sdl);
    return JSON.parse(JSON.stringify(document), (_key, value) =>
      typeof value === "string" ? value.replace(/ac-secret:\/\/([A-Za-z_][A-Za-z0-9_]*)$/, (reference, name: string) => secrets[name] ?? reference) : value
    );
  }
});
