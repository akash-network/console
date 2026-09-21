import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultServiceWithPlacement } from "./data";
import {
  credentialSecretSlotKey,
  envSecretSlotKey,
  isReservedSdlValue,
  isSdlReference,
  isValidSecretName,
  resolveSdlSecrets,
  secretNameOf,
  secretReferenceOf
} from "./sdlSecrets";

describe("sdlSecrets", () => {
  describe(isSdlReference.name, () => {
    it("recognizes a secret reference", () => {
      expect(isSdlReference("ac-secret://API_KEY")).toBe(true);
    });

    it("recognizes a reference of a kind it does not know", () => {
      expect(isSdlReference("ac-vault://path")).toBe(true);
    });

    it("rejects a value that merely opens with the prefix", () => {
      expect(isSdlReference("ac-secret://not valid")).toBe(false);
      expect(isSdlReference("ac-milan")).toBe(false);
    });

    it("rejects a plain value", () => {
      expect(isSdlReference("hunter2")).toBe(false);
    });
  });

  describe(isReservedSdlValue.name, () => {
    it("is true for anything opening with the reference prefix, valid reference or not", () => {
      expect(isReservedSdlValue("ac-secret://API_KEY")).toBe(true);
      expect(isReservedSdlValue("ac-milan")).toBe(true);
    });

    it("is false for a plain value", () => {
      expect(isReservedSdlValue("milan-ac")).toBe(false);
    });
  });

  describe(secretNameOf.name, () => {
    it("reads the name out of a secret reference", () => {
      expect(secretNameOf("ac-secret://DB_URL")).toBe("DB_URL");
    });

    it("is null for a reference of another kind", () => {
      expect(secretNameOf("ac-vault://DB_URL")).toBeNull();
    });

    it("is null for a plain value", () => {
      expect(secretNameOf("DB_URL")).toBeNull();
    });
  });

  describe(secretReferenceOf.name, () => {
    it("spells the reference the api resolves against a sealed name", () => {
      expect(secretReferenceOf("DB_URL")).toBe("ac-secret://DB_URL");
    });
  });

  describe(isValidSecretName.name, () => {
    it.each(["API_KEY", "_private", "a1", "A".repeat(64)])("accepts %s", name => {
      expect(isValidSecretName(name)).toBe(true);
    });

    it.each(["1abc", "my.var", "with-dash", "", "A".repeat(65)])("rejects %p", name => {
      expect(isValidSecretName(name)).toBe(false);
    });
  });

  describe(resolveSdlSecrets.name, () => {
    it("names a typed secret after its env key and collects the value under that name", () => {
      const values = formValues([service("web", { env: [env("API_KEY", "hunter2", true)] })]);

      const resolved = resolveSdlSecrets(values, { sealSecrets: true });

      expect(resolved.references.get(envSecretSlotKey(0, 0))).toBe("ac-secret://API_KEY");
      expect(resolved.values).toEqual({ API_KEY: "hunter2" });
      expect(resolved.unresolved).toEqual([]);
    });

    it("leaves a plain variable out of the references and the values", () => {
      const values = formValues([service("web", { env: [env("PORT", "8080", false)] })]);

      const resolved = resolveSdlSecrets(values, { sealSecrets: true });

      expect(resolved.references.size).toBe(0);
      expect(resolved.values).toEqual({});
    });

    it("keeps a secret value exactly as typed rather than trimming it", () => {
      const values = formValues([service("web", { env: [env("TOKEN", " spaced ", true)] })]);

      expect(resolveSdlSecrets(values, { sealSecrets: true }).values).toEqual({ TOKEN: " spaced " });
    });

    it("suffixes the name when another service already claimed the same key", () => {
      const values = formValues([service("web", { env: [env("TOKEN", "a", true)] }), service("api", { env: [env("TOKEN", "b", true)] })]);

      const resolved = resolveSdlSecrets(values, { sealSecrets: true });

      expect(resolved.references.get(envSecretSlotKey(0, 0))).toBe("ac-secret://TOKEN");
      expect(resolved.references.get(envSecretSlotKey(1, 0))).toBe("ac-secret://TOKEN_2");
      expect(resolved.values).toEqual({ TOKEN: "a", TOKEN_2: "b" });
    });

    it("never mints a name a kept reference already stands on, wherever it stands", () => {
      const values = formValues([service("web", { env: [env("TOKEN", "typed", true)] }), service("api", { env: [env("OTHER", "ac-secret://TOKEN", true)] })]);

      const resolved = resolveSdlSecrets(values, { sealSecrets: true });

      expect(resolved.references.get(envSecretSlotKey(0, 0))).toBe("ac-secret://TOKEN_2");
      expect(resolved.values).toEqual({ TOKEN_2: "typed" });
    });

    it("carries a reference-valued secret through verbatim and reports it as unresolved when nothing holds it", () => {
      const values = formValues([service("web", { env: [env("DB_URL", "ac-secret://DB_URL", true)] })]);

      const resolved = resolveSdlSecrets(values, { sealSecrets: true });

      expect(resolved.references.get(envSecretSlotKey(0, 0))).toBe("ac-secret://DB_URL");
      expect(resolved.values).toEqual({});
      expect(resolved.unresolved).toEqual([{ serviceTitle: "web", label: "DB_URL", name: "DB_URL" }]);
    });

    it("does not report a reference-valued secret whose name the caller says is held", () => {
      const values = formValues([service("web", { env: [env("DB_URL", "ac-secret://DB_URL", true)] })]);

      const resolved = resolveSdlSecrets(values, { sealSecrets: true, heldNames: ["DB_URL"] });

      expect(resolved.unresolved).toEqual([]);
    });

    it("still emits a reference for a secret with no value yet, and reports it as unresolved", () => {
      const values = formValues([service("web", { env: [env("API_KEY", "", true)] })]);

      const resolved = resolveSdlSecrets(values, { sealSecrets: true });

      expect(resolved.references.get(envSecretSlotKey(0, 0))).toBe("ac-secret://API_KEY");
      expect(resolved.values).toEqual({});
      expect(resolved.unresolved).toEqual([{ serviceTitle: "web", label: "API_KEY", name: "API_KEY" }]);
    });

    it("seals typed registry credentials under fixed names when asked to", () => {
      const values = formValues([service("web", { hasCredentials: true, credentials: { host: "ghcr.io", username: "alice", password: "hunter22" } })]);

      const resolved = resolveSdlSecrets(values, { sealSecrets: true });

      expect(resolved.references.get(credentialSecretSlotKey(0, "username"))).toBe("ac-secret://REGISTRY_USERNAME");
      expect(resolved.references.get(credentialSecretSlotKey(0, "password"))).toBe("ac-secret://REGISTRY_PASSWORD");
      expect(resolved.values).toEqual({ REGISTRY_USERNAME: "alice", REGISTRY_PASSWORD: "hunter22" });
    });

    it("leaves registry credentials alone unless asked to seal them", () => {
      const values = formValues([service("web", { hasCredentials: true, credentials: { host: "ghcr.io", username: "alice", password: "hunter22" } })]);

      const resolved = resolveSdlSecrets(values);

      expect(resolved.references.size).toBe(0);
      expect(resolved.values).toEqual({});
    });

    it("keeps a suffixed name within the length the api accepts by displacing the tail of a long key", () => {
      const longKey = "A".repeat(64);
      const values = formValues([
        service("web", { env: [{ id: "a", key: longKey, value: "one", isSecret: true }] }),
        service("api", { env: [{ id: "b", key: longKey, value: "two", isSecret: true }] })
      ]);

      const resolved = resolveSdlSecrets(values, { sealSecrets: true });

      const names = Object.keys(resolved.values);
      expect(names).toHaveLength(2);
      names.forEach(name => expect(name.length).toBeLessThanOrEqual(64));
      expect(new Set(names).size).toBe(2);
    });

    it("suffixes registry credential names when a second service also has credentials", () => {
      const credentials = { host: "ghcr.io", username: "alice", password: "hunter22" };
      const values = formValues([service("web", { hasCredentials: true, credentials }), service("api", { hasCredentials: true, credentials })]);

      const resolved = resolveSdlSecrets(values, { sealSecrets: true });

      expect(resolved.references.get(credentialSecretSlotKey(1, "password"))).toBe("ac-secret://REGISTRY_PASSWORD_2");
    });

    it("gives way to an env secret that already took a registry name", () => {
      const values = formValues([
        service("web", {
          env: [env("REGISTRY_PASSWORD", "x", true)],
          hasCredentials: true,
          credentials: { host: "ghcr.io", username: "alice", password: "hunter22" }
        })
      ]);

      const resolved = resolveSdlSecrets(values, { sealSecrets: true });

      expect(resolved.references.get(credentialSecretSlotKey(0, "password"))).toBe("ac-secret://REGISTRY_PASSWORD_2");
    });

    it("carries a kept registry password through verbatim and reports it as unresolved when nothing holds it", () => {
      const values = formValues([
        service("web", { hasCredentials: true, credentials: { host: "ghcr.io", username: "alice", password: "ac-secret://REGISTRY_PASSWORD" } })
      ]);

      const resolved = resolveSdlSecrets(values, { sealSecrets: true });

      expect(resolved.references.get(credentialSecretSlotKey(0, "password"))).toBe("ac-secret://REGISTRY_PASSWORD");
      expect(resolved.values).toEqual({ REGISTRY_USERNAME: "alice" });
      expect(resolved.unresolved).toEqual([{ serviceTitle: "web", label: "registry password", name: "REGISTRY_PASSWORD" }]);
    });

    it("emits nothing for an empty registry username, which the schema leaves optional", () => {
      const values = formValues([service("web", { hasCredentials: true, credentials: { host: "ghcr.io", username: "", password: "hunter22" } })]);

      const resolved = resolveSdlSecrets(values, { sealSecrets: true });

      expect(resolved.references.has(credentialSecretSlotKey(0, "username"))).toBe(false);
      expect(resolved.values).toEqual({ REGISTRY_PASSWORD: "hunter22" });
    });

    it("ignores credentials the service has switched off", () => {
      const values = formValues([service("web", { hasCredentials: false, credentials: { host: "ghcr.io", username: "alice", password: "hunter22" } })]);

      const resolved = resolveSdlSecrets(values, { sealSecrets: true });

      expect(resolved.references.size).toBe(0);
    });
  });

  function env(key: string, value: string, isSecret: boolean): NonNullable<ServiceType["env"]>[number] {
    return { id: `${key}-id`, key, value, isSecret };
  }

  function service(title: string, overrides: Partial<ServiceType>): ServiceType {
    return { ...defaultServiceWithPlacement().services[0], id: `${title}-id`, title, ...overrides };
  }

  function formValues(services: ServiceType[]): SdlBuilderFormValuesType {
    const base = defaultServiceWithPlacement();
    return { ...base, services: services.map(entry => ({ ...entry, placementId: base.placements[0].id })) };
  }
});
