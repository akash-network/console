import type { SDLInput } from "@akashnetwork/chain-sdk";
import { yaml } from "@akashnetwork/chain-sdk";
import { faker } from "@faker-js/faker";
import { dump } from "js-yaml";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { BlockedGpuService } from "@src/deployment/services/blocked-gpu/blocked-gpu.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { stripSdlSecrets } from "./sdl-secret-stripping";

import { mockConfigService } from "@test/mocks/config-service.mock";

const IMAGE = "ghcr.io/akash-network/hello-akash-world:2.1.0";

/** Generous enough that every test but the size ones is measuring stripping rather than the limit. */
const MAX_LENGTH = 128 * 1024;

describe(stripSdlSecrets.name, () => {
  describe("environment values", () => {
    it("keeps the variable name and drops its value", () => {
      const token = faker.string.alphanumeric(24);

      const stripped = strip(sdlWith({ web: { env: [`API_TOKEN=${token}`] } }));

      expect(stripped.services.web.env).toEqual(["API_TOKEN="]);
    });

    it("drops a value that itself contains an equals sign", () => {
      const password = faker.internet.password();

      const stripped = strip(sdlWith({ web: { env: [`DATABASE_URL=postgres://u:${password}@h:5432/db?ssl=true&a=b`] } }));

      expect(stripped.services.web.env).toEqual(["DATABASE_URL="]);
    });

    it("leaves an entry that names no value alone", () => {
      const stripped = strip(sdlWith({ web: { env: ["INHERITED_FROM_HOST"] } }));

      expect(stripped.services.web.env).toEqual(["INHERITED_FROM_HOST"]);
    });

    it("leaves an explicitly null env list alone", () => {
      const stripped = strip(sdlWith({ web: { env: null } }));

      expect(stripped.services.web.env).toBeNull();
    });

    it("leaves a service that declares no env alone", () => {
      const stripped = strip(sdlWith({ web: {} }));

      expect(stripped.services.web).not.toHaveProperty("env");
    });

    it("strips the env of every service, not only the first", () => {
      const stripped = strip(sdlWith({ web: { env: [`A=${faker.string.alphanumeric(8)}`] }, worker: { env: [`B=${faker.string.alphanumeric(8)}`] } }));

      expect(stripped.services.web.env).toEqual(["A="]);
      expect(stripped.services.worker.env).toEqual(["B="]);
    });
  });

  describe("a value that refers to a secret rather than carrying one", () => {
    it("keeps a whole sdl reference", () => {
      const stripped = strip(sdlWith({ web: { env: ["API_TOKEN=ac-secret://API_TOKEN"] } }));

      expect(stripped.services.web.env).toEqual(["API_TOKEN=ac-secret://API_TOKEN"]);
    });

    it("keeps a reference whose name differs from the variable it is assigned to", () => {
      const stripped = strip(sdlWith({ web: { env: ["DATABASE_URL=ac-secret://PROD_DB"] } }));

      expect(stripped.services.web.env).toEqual(["DATABASE_URL=ac-secret://PROD_DB"]);
    });

    it("keeps a reference of a kind no resolver is registered for", () => {
      const stripped = strip(sdlWith({ web: { env: ["MODE=ac-var://MODE"] } }));

      expect(stripped.services.web.env).toEqual(["MODE=ac-var://MODE"]);
    });

    it("keeps the reference of every service that carries one", () => {
      const stripped = strip(sdlWith({ web: { env: ["T=ac-secret://T"] }, worker: { env: ["T=ac-secret://T"] } }));

      expect(stripped.services.web.env).toEqual(["T=ac-secret://T"]);
      expect(stripped.services.worker.env).toEqual(["T=ac-secret://T"]);
    });

    it("drops a value that merely opens with the reserved prefix", () => {
      const stripped = strip(sdlWith({ web: { env: ["MODE=ac-dc"] } }));

      expect(stripped.services.web.env).toEqual(["MODE="]);
    });

    it("drops a reference embedded in a larger value", () => {
      const stripped = strip(sdlWith({ web: { env: ["T=prefix-ac-secret://T"] } }));

      expect(stripped.services.web.env).toEqual(["T="]);
    });

    it("drops a value that is a reference followed by anything else", () => {
      const stripped = strip(sdlWith({ web: { env: ["T=ac-secret://T suffix"] } }));

      expect(stripped.services.web.env).toEqual(["T="]);
    });

    it("drops a value that is a reference followed by a line terminator", () => {
      const stripped = strip(sdlWith({ web: { env: ["T=ac-secret://T\n"] } }));

      expect(stripped.services.web.env).toEqual(["T="]);
    });

    it("drops a value naming a kind longer than the grammar allows", () => {
      const stripped = strip(sdlWith({ web: { env: [`T=ac-${"z".repeat(17)}://T`] } }));

      expect(stripped.services.web.env).toEqual(["T="]);
    });

    it("keeps a reference while dropping an ordinary value beside it", () => {
      const token = faker.string.alphanumeric(24);

      const stripped = strip(sdlWith({ web: { env: ["SECRET=ac-secret://SECRET", `PLAIN=${token}`, "INHERITED_FROM_HOST"] } }));

      expect(stripped.services.web.env).toEqual(["SECRET=ac-secret://SECRET", "PLAIN=", "INHERITED_FROM_HOST"]);
    });
  });

  describe("private registry credentials", () => {
    it("removes the whole block, not just the password", () => {
      const stripped = strip(
        sdlWith({
          web: {
            credentials: { host: "registry.example.test", username: faker.string.alphanumeric(10), password: faker.internet.password() }
          }
        })
      );

      expect(stripped.services.web).not.toHaveProperty("credentials");
    });

    it("removes the block of every service that declares one", () => {
      const credentials = { host: "registry.example.test", username: faker.string.alphanumeric(10), password: faker.internet.password() };

      const stripped = strip(sdlWith({ web: { credentials }, worker: { credentials } }));

      expect(stripped.services.web).not.toHaveProperty("credentials");
      expect(stripped.services.worker).not.toHaveProperty("credentials");
    });
  });

  describe("a value that is also an ordinary part of the SDL", () => {
    it("keeps a service whose name another service's env value happens to equal", () => {
      const stripped = strip(sdlWith({ wordpress: { env: ["WORDPRESS_DB_HOST=db"] }, db: { env: ["MYSQL_DATABASE=wordpress"] } }));

      expect(Object.keys(stripped.services)).toEqual(["wordpress", "db"]);
      expect(stripped.services.db.image).toBe(IMAGE);
      expect(Object.keys(stripped.deployment)).toEqual(["wordpress", "db"]);
      expect(Object.keys(stripped.profiles.compute)).toEqual(["wordpress", "db"]);
    });

    it("keeps a placement denom an env value happens to equal", () => {
      const stripped = strip(sdlWith({ web: { env: ["DENOM=uakt"] } }));

      expect(stripped.profiles.placement.dcloud.pricing.web.denom).toBe("uakt");
    });

    it("keeps an image an env value happens to equal", () => {
      const stripped = strip(sdlWith({ web: { image: "nginx", env: ["IMAGE_NAME=nginx"] } }));

      expect(stripped.services.web.image).toBe("nginx");
    });

    it("keeps a map key an env value happens to equal", () => {
      const stripped = strip(sdlWith({ web: { env: ["PROFILE=dcloud"] } }));

      expect(stripped.profiles.placement).toHaveProperty("dcloud");
    });
  });

  describe("a copy of a value the SDL made for itself", () => {
    it("keeps the copy an aliased env list left in args, stripping only where the value is declared", () => {
      const token = faker.string.alphanumeric(12);
      const sharedEnv = [`API_TOKEN=${token}`];

      const stripped = strip(dump(sdlDocument({ web: { env: sharedEnv, args: sharedEnv } })));

      expect(stripped.services.web.env).toEqual(["API_TOKEN="]);
      expect(stripped.services.web.args).toEqual(["API_TOKEN="]);
    });

    it("keeps a value typed out a second time in args, which the env declaration cannot reach", () => {
      const token = faker.string.alphanumeric(12);

      const stripped = strip(sdlWith({ web: { env: [`API_TOKEN=${token}`], args: [`--token=${token}`] } }));

      expect(stripped.services.web.env).toEqual(["API_TOKEN="]);
      expect(stripped.services.web.args).toEqual([`--token=${token}`]);
    });
  });

  describe("the stripped output", () => {
    it("stays an SDL the manifest generator still accepts", () => {
      const submitted = sdlWith({ web: { env: [`API_TOKEN=${faker.string.alphanumeric(12)}`] } });

      expect(manifestFrom(storedSdlOf(submitted)).ok).toBe(true);
    });

    it("stays an SDL the manifest generator accepts when an env value equals the service name", () => {
      const submitted = sdlWith({ wordpress: { env: ["WORDPRESS_DB_HOST=db"] }, db: {} });

      expect(manifestFrom(storedSdlOf(submitted)).ok).toBe(true);
    });

    it("stays an SDL the manifest generator accepts when an env value equals the denom", () => {
      const submitted = sdlWith({ web: { env: ["DENOM=uakt"] } });

      expect(manifestFrom(storedSdlOf(submitted)).ok).toBe(true);
    });

    it("still generates a manifest for an SDL that declares no env at all", () => {
      expect(manifestFrom(storedSdlOf(sdlWith({ web: {} }))).ok).toBe(true);
    });

    it("strips an already stripped SDL to the same thing again", () => {
      const once = storedSdlOf(sdlWith({ web: { env: [`API_TOKEN=${faker.string.alphanumeric(12)}`] } }));

      expect(storedSdlOf(once)).toBe(once);
    });
  });

  describe("an SDL too large to store", () => {
    it("returns nothing rather than the document, reporting the size it measured", () => {
      const result = stripSdlSecrets(sdlWith({ web: { args: ["x".repeat(2048)] } }), 512);

      expect(result.sdl).toBeNull();
      expect(result.length).toBeGreaterThan(512);
    });

    it("refuses a document whose aliases multiply a scalar past the limit, stopping at the budget rather than serializing it", () => {
      const scalarLength = 4096;
      const aliasCount = 512;
      const lengthIfItHadBeenSerialized = scalarLength * aliasCount;

      const result = stripSdlSecrets(sdlAliasingOneScalar({ scalarLength, aliasCount }), 8192);

      expect(result.sdl).toBeNull();
      expect(result.length).toBeGreaterThan(8192);
      expect(result.length).toBeLessThan(lengthIfItHadBeenSerialized);
    });

    it("measures an aliased scalar once per alias, as serializing it would write it", () => {
      const oneAlias = stripSdlSecrets(sdlAliasingOneScalar({ scalarLength: 4096, aliasCount: 1 }), 8192).length;
      const manyAliases = stripSdlSecrets(sdlAliasingOneScalar({ scalarLength: 4096, aliasCount: 512 }), 8192).length;

      expect(manyAliases).toBeGreaterThan(oneAlias);
    });

    it("stores a document with no anchors that fits, without consulting the estimate", () => {
      const stripped = stripSdlSecrets(sdlWith({ web: { env: [`API_TOKEN=${faker.string.alphanumeric(12)}`] } }), MAX_LENGTH);

      expect(stripped.sdl).toContain("API_TOKEN=");
      expect(stripped.length).toBe(stripped.sdl?.length);
    });

    it("measures a document with no anchors by serializing it exactly", () => {
      const submitted = sdlWith({ web: { args: ["x".repeat(4096)] } });

      const result = stripSdlSecrets(submitted, 512);

      expect(result.sdl).toBeNull();
      expect(result.length).toBe(dump(yaml.raw(submitted), { lineWidth: -1 }).length);
    });

    it("stores a document whose scalars merely contain an ampersand and an asterisk", () => {
      const submitted = sdlWith({ web: { args: ["sh", "-c", "start && tail -f *.log"], env: [`TOKEN=${faker.string.alphanumeric(8)}&x*y`] } });

      const stripped = strip(submitted);

      expect(stripped.services.web.args).toEqual(["sh", "-c", "start && tail -f *.log"]);
      expect(stripped.services.web.env).toEqual(["TOKEN="]);
    });

    it("returns a document that fits", () => {
      expect(stripSdlSecrets(sdlWith({ web: {} }), MAX_LENGTH).sdl).toContain("services:");
    });
  });

  type ServiceOverrides = Record<string, unknown>;

  function strip(rawSdl: string) {
    return yaml.raw<SDLInput>(storedSdlOf(rawSdl));
  }

  function storedSdlOf(rawSdl: string): string {
    const { sdl } = stripSdlSecrets(rawSdl, MAX_LENGTH);
    expect(sdl).not.toBeNull();
    return sdl as string;
  }

  /** JSON is a subset of YAML, so building the fixture as an object keeps indentation out of the tests. */
  function sdlWith(services: Record<string, ServiceOverrides>): string {
    return JSON.stringify(sdlDocument(services));
  }

  function sdlDocument(services: Record<string, ServiceOverrides>) {
    const names = Object.keys(services);

    return {
      version: "2.0",
      services: Object.fromEntries(
        Object.entries(services).map(([name, overrides]) => [name, { image: IMAGE, expose: [{ port: 3000, as: 80, to: [{ global: true }] }], ...overrides }])
      ),
      profiles: {
        compute: Object.fromEntries(names.map(name => [name, { resources: { cpu: { units: 0.5 }, memory: { size: "512Mi" }, storage: [{ size: "512Mi" }] } }])),
        placement: { dcloud: { pricing: Object.fromEntries(names.map(name => [name, { denom: "uakt", amount: 1000 }])) } }
      },
      deployment: Object.fromEntries(names.map(name => [name, { dcloud: { profile: name, count: 1 } }]))
    };
  }

  /**
   * An SDL whose `args` point one anchored scalar at itself many times over. js-yaml emits it as an
   * anchor and N aliases, but loads it back as N independent strings, so serializing writes the scalar
   * out in full every time — the shape that turns a small request into a huge document.
   */
  function sdlAliasingOneScalar({ scalarLength, aliasCount }: { scalarLength: number; aliasCount: number }): string {
    const args = ["    args:", `      - &payload ${"x".repeat(scalarLength)}`, ...Array.from({ length: aliasCount - 1 }, () => "      - *payload")];

    return dump(sdlDocument({ web: {} })).replace(`    image: ${IMAGE}`, [`    image: ${IMAGE}`, ...args].join("\n"));
  }

  function manifestFrom(rawSdl: string) {
    const config = mock<BillingConfig>({ DEPLOYMENT_GRANT_DENOM: "uakt", MANAGED_WALLET_LEASE_ALLOWED_AUDITORS: [] });
    const blockedGpuService = new BlockedGpuService(mockConfigService<BillingConfigService>({ MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: [] }));

    return new SdlService(config, blockedGpuService, new SdlReferenceService()).generateManifest(rawSdl);
  }
});
