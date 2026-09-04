import type { SDLInput } from "@akashnetwork/chain-sdk";
import { yaml } from "@akashnetwork/chain-sdk";
import { faker } from "@faker-js/faker";
import { dump } from "js-yaml";
import { describe, expect, it } from "vitest";

import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import { isSdlReference, MAX_SDL_REFERENCE_NAME_LENGTH, SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { SdlSecretsDerivationService } from "./sdl-secrets-derivation.service";

const IMAGE = "ghcr.io/akash-network/hello-akash-world:2.1.0";
const REGISTRY_HOST = "registry.example.test";
const REGISTRY_EMAIL = "ops@example.test";

describe(SdlSecretsDerivationService.name, () => {
  describe("when no seal said which values are secret", () => {
    it("takes an env value out and leaves a reference where it stood", () => {
      const { service } = setup();
      const token = faker.string.alphanumeric(24);
      const document = documentWith({ web: { env: [`API_TOKEN=${token}`] } });

      const { secrets } = service.derive(document, { includeEnvValues: true });

      expect(secrets).toEqual({ s0_e0: token });
      expect(document.services.web.env).toEqual(["API_TOKEN=ac-secret://s0_e0"]);
    });

    it("names each position from its service's place in the document and its own", () => {
      const { service } = setup();
      const document = documentWith({
        web: { env: [`A=${faker.string.alphanumeric(8)}`, `B=${faker.string.alphanumeric(8)}`] },
        worker: { env: [`C=${faker.string.alphanumeric(8)}`] }
      });

      service.derive(document, { includeEnvValues: true });

      expect(document.services.web.env).toEqual(["A=ac-secret://s0_e0", "B=ac-secret://s0_e1"]);
      expect(document.services.worker.env).toEqual(["C=ac-secret://s1_e0"]);
    });

    it("gives two services their own name for the same variable name", () => {
      const { service } = setup();
      const [web, worker] = [faker.string.alphanumeric(16), faker.string.alphanumeric(16)];

      const { secrets } = service.derive(documentWith({ web: { env: [`PASSWORD=${web}`] }, worker: { env: [`PASSWORD=${worker}`] } }), {
        includeEnvValues: true
      });

      expect(secrets).toEqual({ s0_e0: web, s1_e0: worker });
    });

    it("takes both halves of a registry credential and leaves its host and email alone", () => {
      const { service } = setup();
      const [username, password] = [faker.string.alphanumeric(10), faker.internet.password()];
      const document = documentWith({ web: { credentials: { host: REGISTRY_HOST, email: REGISTRY_EMAIL, username, password } } });

      const { secrets } = service.derive(document, { includeEnvValues: true });

      expect(secrets).toEqual({ s0_c_username: username, s0_c_password: password });
      expect(document.services.web.credentials).toEqual({
        host: REGISTRY_HOST,
        email: REGISTRY_EMAIL,
        username: "ac-secret://s0_c_username",
        password: "ac-secret://s0_c_password"
      });
    });

    it("takes an empty value out as an empty value rather than as no value at all", () => {
      const { service } = setup();
      const document = documentWith({ web: { env: ["EXPLICITLY_EMPTY=", "INHERITED_FROM_HOST"] } });

      const { secrets } = service.derive(document, { includeEnvValues: true });

      expect(secrets).toEqual({ s0_e0: "" });
      expect(document.services.web.env).toEqual(["EXPLICITLY_EMPTY=ac-secret://s0_e0", "INHERITED_FROM_HOST"]);
    });

    it("leaves a value that already names a secret alone, inventing no value for it", () => {
      const { service } = setup();
      const document = documentWith({ web: { env: ["API_TOKEN=ac-secret://API_TOKEN", `LOG_LEVEL=${faker.string.alphanumeric(5)}`] } });

      const { secrets } = service.derive(document, { includeEnvValues: true });

      expect(Object.keys(secrets)).toEqual(["s0_e1"]);
      expect(document.services.web.env![0]).toBe("API_TOKEN=ac-secret://API_TOKEN");
    });

    it("takes nothing from a document that carries no env and no credentials", () => {
      const { service } = setup();

      expect(service.derive(documentWith({ web: {} }), { includeEnvValues: true })).toEqual({ secrets: {}, derivedCount: 0 });
    });

    it.each([{ env: null }, {}])("leaves the service declaring %j untouched", overrides => {
      const { service } = setup();

      expect(service.derive(documentWith({ web: overrides }), { includeEnvValues: true }).secrets).toEqual({});
    });

    it("reports how many positions it rewrote without reporting any of their values", () => {
      const { service } = setup();
      const document = documentWith({ web: { env: [`A=${faker.string.alphanumeric(8)}`, `B=${faker.string.alphanumeric(8)}`] } });

      expect(service.derive(document, { includeEnvValues: true }).derivedCount).toBe(2);
    });
  });

  describe("when a seal already said which values are secret", () => {
    it("leaves every env value exactly as submitted", () => {
      const { service } = setup();
      const token = faker.string.alphanumeric(24);
      const document = documentWith({ web: { env: [`API_TOKEN=${token}`] } });

      const { secrets } = service.derive(document, { includeEnvValues: false });

      expect(secrets).toEqual({});
      expect(document.services.web.env).toEqual([`API_TOKEN=${token}`]);
    });

    it("still takes a registry credential, which is a secret whatever it holds", () => {
      const { service } = setup();
      const [username, password] = [faker.string.alphanumeric(10), faker.internet.password()];
      const document = documentWith({
        web: { env: [`LOG_LEVEL=${faker.string.alphanumeric(5)}`], credentials: { host: REGISTRY_HOST, username, password } }
      });

      const { secrets } = service.derive(document, { includeEnvValues: false });

      expect(secrets).toEqual({ s0_c_username: username, s0_c_password: password });
      expect(document.services.web.credentials!.password).toBe("ac-secret://s0_c_password");
    });

    it("leaves a credential that already names a secret alone", () => {
      const { service } = setup();
      const document = documentWith({
        web: { credentials: { host: REGISTRY_HOST, username: "ac-secret://REG_USER", password: "ac-secret://REG_PASS" } }
      });

      expect(service.derive(document, { includeEnvValues: false }).secrets).toEqual({});
    });
  });

  describe("whether a value already names a secret, which the grammar decides and not the prefix", () => {
    it.each(["ac-secret://TOKEN", "ac-secret://PROD_DB", "ac-var://MODE"])("leaves %j where it stands, the grammar accepting it whole", value => {
      const { service } = setup();
      const document = documentWith({ web: { env: [`T=${value}`] } });

      expect(service.derive(document, { includeEnvValues: true }).secrets).toEqual({});
      expect(document.services.web.env).toEqual([`T=${value}`]);
    });

    it.each(["ac-dc", "prefix-ac-secret://T", "ac-secret://T suffix", "ac-secret://T\n", `ac-${"z".repeat(17)}://T`])(
      "takes %j out, the grammar refusing it as a reference",
      value => {
        const { service } = setup();
        const document = documentWith({ web: { env: [`T=${value}`] } });

        expect(service.derive(document, { includeEnvValues: true }).secrets).toEqual({ s0_e0: value });
        expect(document.services.web.env).toEqual(["T=ac-secret://s0_e0"]);
      }
    );

    it("leaves the reference of every service that carries one", () => {
      const { service } = setup();
      const document = documentWith({ web: { env: ["T=ac-secret://T"] }, worker: { env: ["T=ac-secret://T"] } });

      expect(service.derive(document, { includeEnvValues: true }).secrets).toEqual({});
      expect(document.services.web.env).toEqual(["T=ac-secret://T"]);
      expect(document.services.worker.env).toEqual(["T=ac-secret://T"]);
    });

    it("takes a value containing an equals sign whole, splitting only on the first", () => {
      const { service } = setup();
      const url = `postgres://u:${faker.internet.password()}@h:5432/db?ssl=true&a=b`;
      const document = documentWith({ web: { env: [`DATABASE_URL=${url}`] } });

      expect(service.derive(document, { includeEnvValues: true }).secrets).toEqual({ s0_e0: url });
      expect(document.services.web.env).toEqual(["DATABASE_URL=ac-secret://s0_e0"]);
    });
  });

  describe("a copy of a value the document made for itself", () => {
    it("rewrites the env declaration an aliased list is shared through, and the copy in args with it", () => {
      const { service } = setup();
      const token = faker.string.alphanumeric(12);
      const document = yaml.raw<SDLInput>(sdlSharingOneListBetweenEnvAndArgs(`API_TOKEN=${token}`));

      const { secrets } = service.derive(document, { includeEnvValues: true });

      expect(secrets).toEqual({ s0_e0: token });
      expect(document.services.web.env).toEqual(["API_TOKEN=ac-secret://s0_e0"]);
      expect(document.services.web.args).toEqual(["API_TOKEN=ac-secret://s0_e0"]);
    });

    it("leaves a value typed out a second time in args, which the env declaration cannot reach", () => {
      const { service } = setup();
      const token = faker.string.alphanumeric(12);
      const document = documentWith({ web: { env: [`API_TOKEN=${token}`], args: [`--token=${token}`] } });

      service.derive(document, { includeEnvValues: true });

      expect(document.services.web.env).toEqual(["API_TOKEN=ac-secret://s0_e0"]);
      expect(document.services.web.args).toEqual([`--token=${token}`]);
    });
  });

  describe("a node two services share through a yaml anchor", () => {
    it("mints one name for one shared credentials block rather than one per service", () => {
      const { service } = setup();
      const password = faker.internet.password();
      const document = yaml.raw<SDLInput>(sdlSharingCredentials(password));

      const { secrets } = service.derive(document, { includeEnvValues: false });

      expect(Object.keys(secrets)).toEqual(["s0_c_username", "s0_c_password"]);
      expect(secrets.s0_c_password).toBe(password);
      expect(document.services.web.credentials!.password).toBe("ac-secret://s0_c_password");
      expect(document.services.worker.credentials!.password).toBe("ac-secret://s0_c_password");
    });

    it("mints one name for one shared env list rather than one per service", () => {
      const { service } = setup();
      const token = faker.string.alphanumeric(20);
      const document = yaml.raw<SDLInput>(sdlSharingEnv(`API_TOKEN=${token}`));

      const { secrets } = service.derive(document, { includeEnvValues: true });

      expect(secrets).toEqual({ s0_e0: token });
      expect(document.services.web.env).toEqual(["API_TOKEN=ac-secret://s0_e0"]);
      expect(document.services.worker.env).toEqual(["API_TOKEN=ac-secret://s0_e0"]);
    });
  });

  describe("the names it mints", () => {
    it("are names the reference grammar accepts", () => {
      const { service } = setup();
      const document = documentWith({
        web: { env: [`A=${faker.string.alphanumeric(8)}`], credentials: { host: REGISTRY_HOST, username: "u", password: faker.internet.password() } },
        "a-service-name-the-grammar-would-refuse.42": { env: [`B=${faker.string.alphanumeric(8)}`] }
      });

      const { secrets } = service.derive(document, { includeEnvValues: true });

      expect(Object.keys(secrets)).toHaveLength(4);
      Object.keys(secrets).forEach(name => expect(isSdlReference(`ac-secret://${name}`)).toBe(true));
    });

    it("stay within the longest name the grammar accepts, for a document far larger than one can be", () => {
      const { service } = setup();
      const document = documentWith({ web: { env: Array.from({ length: 5000 }, (_, index) => `SETTING_${index}=v`) } });

      const { secrets } = service.derive(document, { includeEnvValues: true });
      const longest = Object.keys(secrets).reduce((longestSoFar, name) => Math.max(longestSoFar, name.length), 0);

      expect(Object.keys(secrets)).toHaveLength(5000);
      expect(longest).toBeLessThanOrEqual(MAX_SDL_REFERENCE_NAME_LENGTH);
    });
  });

  describe("what replacing a value with a reference costs the stored document", () => {
    it("leaves an env-heavy document of a realistic size far inside the bound the console stores against", () => {
      const { service } = setup();
      const document = documentWith({ web: { env: Array.from({ length: 200 }, (_, index) => `SETTING_${index}=${faker.string.alphanumeric(48)}`) } });

      service.derive(document, { includeEnvValues: true });

      expect(dump(document, { lineWidth: -1 }).length).toBeLessThan(SDL_MAX_LENGTH / 4);
    });

    it("leaves three thousand entries inside that bound, an order of magnitude past what a deployment carries", () => {
      const { service } = setup();
      const document = documentWith({ web: { env: Array.from({ length: 3000 }, (_, index) => `SETTING_${index}=${faker.string.alphanumeric(6)}`) } });

      service.derive(document, { includeEnvValues: true });

      expect(dump(document, { lineWidth: -1 }).length).toBeLessThan(SDL_MAX_LENGTH);
    });
  });

  it("resolves back to the values it took out after the document has been through yaml and back", () => {
    const { service, sdlReferenceService } = setup();
    const values = [
      "a: b #c |x >y {z} [w] &anchor *alias \"q\" 's'",
      "line\nbreak\ttab",
      "-----BEGIN KEY-----\nMIIBogIBAAJ/\\slash\n-----END KEY-----",
      "  leading and trailing  "
    ];
    const rewritten = documentWith({ web: { env: values.map((value, index) => `V${index}=${value}`) } });

    const { secrets } = service.derive(rewritten, { includeEnvValues: true });
    const reparsed = yaml.raw<SDLInput>(dump(rewritten, { lineWidth: -1 }));
    const byService = Object.fromEntries(Object.keys(reparsed.services).map(serviceName => [serviceName, secrets]));

    expect(sdlReferenceService.substitute(reparsed, { secrets: byService })).toEqual([]);
    expect(reparsed.services.web.env).toEqual(values.map((value, index) => `V${index}=${value}`));
  });

  it("leaves a document that resolves back to the one it was given", () => {
    const { service, sdlReferenceService } = setup();
    const services = {
      web: {
        env: [`API_TOKEN=${faker.string.alphanumeric(24)}`, "INHERITED_FROM_HOST", "EXPLICITLY_EMPTY="],
        credentials: { host: REGISTRY_HOST, email: REGISTRY_EMAIL, username: faker.string.alphanumeric(10), password: faker.internet.password() }
      },
      worker: { env: [`DATABASE_URL=postgres://u:${faker.internet.password()}@h:5432/db?ssl=true&a=b`] }
    };
    const submitted = documentWith(services);
    const rewritten = documentWith(services);

    const { secrets } = service.derive(rewritten, { includeEnvValues: true });
    const byService = Object.fromEntries(Object.keys(rewritten.services).map(serviceName => [serviceName, secrets]));

    expect(sdlReferenceService.substitute(rewritten, { secrets: byService })).toEqual([]);
    expect(rewritten).toEqual(submitted);
  });

  function setup() {
    const sdlReferenceService = new SdlReferenceService();

    return { service: new SdlSecretsDerivationService(sdlReferenceService), sdlReferenceService };
  }

  function documentWith(services: Record<string, Record<string, unknown>>) {
    const names = Object.keys(services);

    return yaml.raw<SDLInput>(
      JSON.stringify({
        version: "2.0",
        services: Object.fromEntries(Object.entries(services).map(([name, overrides]) => [name, { image: IMAGE, ...overrides }])),
        profiles: {
          compute: Object.fromEntries(names.map(name => [name, { resources: { cpu: { units: 0.5 }, memory: { size: "512Mi" } } }])),
          placement: { dcloud: { pricing: Object.fromEntries(names.map(name => [name, { denom: "uakt", amount: 1000 }])) } }
        },
        deployment: Object.fromEntries(names.map(name => [name, { dcloud: { profile: name, count: 1 } }]))
      })
    );
  }

  function sdlSharingOneListBetweenEnvAndArgs(entry: string) {
    return `version: "2.0"\nservices:\n  web:\n    image: ${IMAGE}\n    env: &shared\n      - ${JSON.stringify(entry)}\n    args: *shared\n`;
  }

  function sdlSharingCredentials(password: string) {
    const block = [
      "    credentials: &registry",
      `      host: ${REGISTRY_HOST}`,
      `      username: ${faker.string.alphanumeric(10)}`,
      `      password: ${JSON.stringify(password)}`
    ].join("\n");

    return `version: "2.0"\nservices:\n  web:\n    image: ${IMAGE}\n${block}\n  worker:\n    image: ${IMAGE}\n    credentials: *registry\n`;
  }

  function sdlSharingEnv(entry: string) {
    return `version: "2.0"\nservices:\n  web:\n    image: ${IMAGE}\n    env: &shared\n      - ${JSON.stringify(entry)}\n  worker:\n    image: ${IMAGE}\n    env: *shared\n`;
  }
});
