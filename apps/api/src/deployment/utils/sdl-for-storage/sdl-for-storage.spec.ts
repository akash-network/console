import type { SDLInput } from "@akashnetwork/chain-sdk";
import { yaml } from "@akashnetwork/chain-sdk";
import { faker } from "@faker-js/faker";
import { dump } from "js-yaml";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import type { CreateLogger } from "@src/core";
import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import { BlockedGpuService } from "@src/deployment/services/blocked-gpu/blocked-gpu.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { parseSdlForStorage, sdlForStorage } from "./sdl-for-storage";

import { mockConfigService } from "@test/mocks/config-service.mock";

const IMAGE = "ghcr.io/akash-network/hello-akash-world:2.1.0";

/** Generous enough that every test but the size ones is measuring stripping rather than the limit. */
const MAX_LENGTH = 128 * 1024;

/** A caller that takes nothing out, so a test can measure what parsing, serializing and the size bound do to a document on their own. */
const TAKING_NOTHING_OUT = () => {};

describe(sdlForStorage.name, () => {
  describe("a document nothing was taken out of", () => {
    it("keeps the value exactly as submitted", () => {
      const token = faker.string.alphanumeric(24);

      const kept = storedDocumentOf(sdlWith({ web: { env: [`API_TOKEN=${token}`] } }));

      expect(kept.services.web.env).toEqual([`API_TOKEN=${token}`]);
    });

    it("keeps a value that itself contains an equals sign", () => {
      const password = faker.internet.password();
      const url = `postgres://u:${password}@h:5432/db?ssl=true&a=b`;

      const kept = storedDocumentOf(sdlWith({ web: { env: [`DATABASE_URL=${url}`] } }));

      expect(kept.services.web.env).toEqual([`DATABASE_URL=${url}`]);
    });

    it("keeps a value carrying yaml metacharacters byte-identical", () => {
      const value = "a: b #c |x >y {z} [w] &anchor *alias \"q\" 's'\nsecond: line\t- dash";

      const kept = storedDocumentOf(sdlWith({ web: { env: [`WEIRD=${value}`] } }));

      expect(kept.services.web.env).toEqual([`WEIRD=${value}`]);
    });

    it("keeps an entry that names no value distinct from one whose value is empty", () => {
      const kept = storedDocumentOf(sdlWith({ web: { env: ["INHERITED_FROM_HOST", "EXPLICITLY_EMPTY="] } }));

      expect(kept.services.web.env).toEqual(["INHERITED_FROM_HOST", "EXPLICITLY_EMPTY="]);
    });

    it("keeps a reference beside an ordinary value", () => {
      const token = faker.string.alphanumeric(24);

      const kept = storedDocumentOf(sdlWith({ web: { env: ["SECRET=ac-secret://SECRET", `PLAIN=${token}`, "INHERITED_FROM_HOST"] } }));

      expect(kept.services.web.env).toEqual(["SECRET=ac-secret://SECRET", `PLAIN=${token}`, "INHERITED_FROM_HOST"]);
    });

    it("keeps the env of every service, not only the first", () => {
      const [first, second] = [faker.string.alphanumeric(8), faker.string.alphanumeric(8)];

      const kept = storedDocumentOf(sdlWith({ web: { env: [`A=${first}`] }, worker: { env: [`B=${second}`] } }));

      expect(kept.services.web.env).toEqual([`A=${first}`]);
      expect(kept.services.worker.env).toEqual([`B=${second}`]);
    });

    it("reparses to the document that was submitted", () => {
      const submitted = sdlWith({
        web: { env: [`API_TOKEN=${faker.string.alphanumeric(24)}`, "SECRET=ac-secret://SECRET", "INHERITED_FROM_HOST"] },
        worker: { env: [`DATABASE_URL=postgres://u:${faker.internet.password()}@h:5432/db?ssl=true`] }
      });

      expect(storedDocumentOf(submitted)).toEqual(yaml.raw<SDLInput>(submitted));
    });
  });

  describe("a caller that takes the values out itself", () => {
    it("is handed a document still carrying every value and credential, so it has something to take", () => {
      const credentials = { host: "registry.example.test", username: faker.string.alphanumeric(10), password: faker.internet.password() };
      const token = faker.string.alphanumeric(24);

      const { document } = parseSdlForStorage(sdlWith({ web: { env: [`API_TOKEN=${token}`], credentials } }));

      expect(document!.services.web.env).toEqual([`API_TOKEN=${token}`]);
      expect(document!.services.web.credentials).toMatchObject(credentials);
    });

    it("stores what the rewrite left behind rather than what arrived", () => {
      const token = faker.string.alphanumeric(24);

      const { sdl } = storedFrom(sdlWith({ web: { env: [`API_TOKEN=${token}`] } }), MAX_LENGTH, document => {
        document.services.web.env = ["API_TOKEN=ac-secret://s0_e0"];
      });

      expect(sdl).toContain("API_TOKEN=ac-secret://s0_e0");
      expect(sdl).not.toContain(token);
    });

    it("measures what the rewrite left rather than what arrived", () => {
      const stored = storedFrom(sdlWith({ web: { env: ["SMALL=v"] } }), 512, document => {
        document.services.web.env = [`SMALL=${"x".repeat(4096)}`];
      });

      expect(stored.sdl).toBeNull();
      expect(stored.length).toBeGreaterThan(512);
    });
  });

  describe("a value that is also an ordinary part of the SDL", () => {
    it("keeps a service whose name another service's env value happens to equal", () => {
      const stored = storedDocumentOf(sdlWith({ wordpress: { env: ["WORDPRESS_DB_HOST=db"] }, db: { env: ["MYSQL_DATABASE=wordpress"] } }));

      expect(Object.keys(stored.services)).toEqual(["wordpress", "db"]);
      expect(stored.services.db.image).toBe(IMAGE);
      expect(Object.keys(stored.deployment)).toEqual(["wordpress", "db"]);
      expect(Object.keys(stored.profiles.compute)).toEqual(["wordpress", "db"]);
    });

    it("keeps a placement denom an env value happens to equal", () => {
      const stored = storedDocumentOf(sdlWith({ web: { env: ["DENOM=uakt"] } }));

      expect(stored.profiles.placement.dcloud.pricing.web.denom).toBe("uakt");
    });

    it("keeps an image an env value happens to equal", () => {
      const stored = storedDocumentOf(sdlWith({ web: { image: "nginx", env: ["IMAGE_NAME=nginx"] } }));

      expect(stored.services.web.image).toBe("nginx");
    });

    it("keeps a map key an env value happens to equal", () => {
      const stored = storedDocumentOf(sdlWith({ web: { env: ["PROFILE=dcloud"] } }));

      expect(stored.profiles.placement).toHaveProperty("dcloud");
    });
  });

  describe("the stored output", () => {
    it("stays an SDL the manifest generator still accepts", async () => {
      const submitted = sdlWith({ web: { env: [`API_TOKEN=${faker.string.alphanumeric(12)}`] } });

      expect((await manifestFrom(storedSdlOf(submitted))).ok).toBe(true);
    });

    it("stays an SDL the manifest generator accepts when an env value equals the service name", async () => {
      const submitted = sdlWith({ wordpress: { env: ["WORDPRESS_DB_HOST=db"] }, db: {} });

      expect((await manifestFrom(storedSdlOf(submitted))).ok).toBe(true);
    });

    it("stays an SDL the manifest generator accepts when an env value equals the denom", async () => {
      const submitted = sdlWith({ web: { env: ["DENOM=uakt"] } });

      expect((await manifestFrom(storedSdlOf(submitted))).ok).toBe(true);
    });

    it("still generates a manifest for an SDL that declares no env at all", async () => {
      expect((await manifestFrom(storedSdlOf(sdlWith({ web: {} })))).ok).toBe(true);
    });

    it("stores an already stored SDL as the same thing again", () => {
      const once = storedSdlOf(sdlWith({ web: { env: [`API_TOKEN=${faker.string.alphanumeric(12)}`] } }));

      expect(storedSdlOf(once)).toBe(once);
    });
  });

  describe("an SDL that is not yaml at all", () => {
    it("reports why it was refused, carrying nothing of the document with it", () => {
      const value = faker.string.alphanumeric(10);

      const result = parseSdlForStorage(`services:\n  web:\n    env:\n      - LEAKED=${value}\n   bad: indentation\n`);

      expect(result).toEqual({ document: null, at: { line: 5, column: 4 } });
      expect(JSON.stringify(result)).not.toContain(value);
      expect(JSON.stringify(result)).not.toContain("LEAKED");
    });
  });

  describe("an SDL too large to store", () => {
    it("returns nothing rather than the document, reporting the size it measured", () => {
      const result = storedFrom(sdlWith({ web: { args: ["x".repeat(2048)] } }), 512);

      expect(result.sdl).toBeNull();
      expect(result.length).toBeGreaterThan(512);
    });

    it("refuses a document whose aliases multiply a scalar past the limit, stopping at the budget rather than serializing it", () => {
      const scalarLength = 4096;
      const aliasCount = 512;
      const lengthIfItHadBeenSerialized = scalarLength * aliasCount;

      const result = storedFrom(sdlAliasingOneScalar({ scalarLength, aliasCount }), 8192);

      expect(result.sdl).toBeNull();
      expect(result.length).toBeGreaterThan(8192);
      expect(result.length).toBeLessThan(lengthIfItHadBeenSerialized);
    });

    it("measures an aliased scalar once per alias, as serializing it would write it", () => {
      const oneAlias = storedFrom(sdlAliasingOneScalar({ scalarLength: 4096, aliasCount: 1 }), 8192).length;
      const manyAliases = storedFrom(sdlAliasingOneScalar({ scalarLength: 4096, aliasCount: 512 }), 8192).length;

      expect(manyAliases).toBeGreaterThan(oneAlias);
    });

    it("stores a document with no anchors that fits, without consulting the estimate", () => {
      const stored = storedFrom(sdlWith({ web: { env: [`API_TOKEN=${faker.string.alphanumeric(12)}`] } }), MAX_LENGTH);

      expect(stored.sdl).toContain("API_TOKEN=");
      expect(stored.length).toBe(stored.sdl?.length);
    });

    it("measures a document with no anchors by serializing it exactly", () => {
      const submitted = sdlWith({ web: { args: ["x".repeat(4096)] } });

      const result = storedFrom(submitted, 512);

      expect(result.sdl).toBeNull();
      expect(result.length).toBe(dump(yaml.raw(submitted), { lineWidth: -1 }).length);
    });

    it("stores a document whose scalars merely contain an ampersand and an asterisk", () => {
      const entry = `TOKEN=${faker.string.alphanumeric(8)}&x*y`;
      const submitted = sdlWith({ web: { args: ["sh", "-c", "start && tail -f *.log"], env: [entry] } });

      const stored = storedDocumentOf(submitted);

      expect(stored.services.web.args).toEqual(["sh", "-c", "start && tail -f *.log"]);
      expect(stored.services.web.env).toEqual([entry]);
    });

    it("returns a document that fits", () => {
      expect(storedFrom(sdlWith({ web: {} }), MAX_LENGTH).sdl).toContain("services:");
    });

    it("refuses a document only the rewrite puts past the limit, against the bound production uses", () => {
      const env = Array.from({ length: 5000 }, (_, index) => `S${index}=v`);
      const submitted = sdlWith({ web: { env } });

      const stored = storedFrom(submitted, SDL_MAX_LENGTH, document => {
        document.services.web.env = env.map((entry, index) => `${entry.slice(0, entry.indexOf("="))}=ac-secret://s0_e${index}`);
      });

      expect(storedSdlOf(submitted).length).toBeLessThan(SDL_MAX_LENGTH);
      expect(stored.sdl).toBeNull();
      expect(stored.length).toBeGreaterThan(SDL_MAX_LENGTH);
    });

    it("stores a document only the rewrite brings inside the limit, against the bound production uses", () => {
      const env = Array.from({ length: 200 }, (_, index) => `BLOB${index}=${"x".repeat(800)}`);
      const submitted = sdlWith({ web: { env } });

      const stored = storedFrom(submitted, SDL_MAX_LENGTH, document => {
        document.services.web.env = env.map((entry, index) => `${entry.slice(0, entry.indexOf("="))}=ac-secret://s0_e${index}`);
      });

      expect(storedFrom(submitted, SDL_MAX_LENGTH).length).toBeGreaterThan(SDL_MAX_LENGTH);
      expect(stored.sdl).toContain("BLOB0=ac-secret://s0_e0");
      expect(stored.length).toBeLessThan(SDL_MAX_LENGTH);
    });

    it("stores an env-heavy sdl of a realistic size against the bound production uses", () => {
      const env = Array.from({ length: 200 }, (_, index) => `SETTING_${index}=${faker.string.alphanumeric(48)}`);

      const { sdl, length } = storedFrom(sdlWith({ web: { env } }), SDL_MAX_LENGTH);

      expect(sdl).not.toBeNull();
      expect(length).toBeLessThan(SDL_MAX_LENGTH / 4);
    });
  });

  type ServiceOverrides = Record<string, unknown>;

  function storedDocumentOf(rawSdl: string) {
    return yaml.raw<SDLInput>(storedSdlOf(rawSdl));
  }

  function storedSdlOf(rawSdl: string): string {
    const { sdl } = storedFrom(rawSdl, MAX_LENGTH);
    expect(sdl).not.toBeNull();
    return sdl as string;
  }

  function storedFrom(rawSdl: string, maxLength: number, takeValuesOut: (document: SDLInput) => void = TAKING_NOTHING_OUT) {
    const parsed = parseSdlForStorage(rawSdl);

    if (parsed.document === null) {
      throw new Error(`fixture is not parseable yaml, at line ${parsed.at?.line}`);
    }

    takeValuesOut(parsed.document);

    return sdlForStorage(parsed, maxLength);
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
    const denomExchangeService = mock<DenomExchangeService>();
    const createLogger: CreateLogger = () => mock<ReturnType<CreateLogger>>();

    return new SdlService(config, blockedGpuService, new SdlReferenceService(), denomExchangeService, createLogger).generateManifest(rawSdl);
  }
});
