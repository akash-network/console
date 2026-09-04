import type { SDLInput } from "@akashnetwork/chain-sdk";
import { yaml } from "@akashnetwork/chain-sdk";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import type { SdlReferenceResolver } from "./sdl-reference.service";
import { MAX_SDL_REFERENCE_NAME_LENGTH, SdlReferenceService } from "./sdl-reference.service";

const VALID_NAMES = ["A", "a", "_", "_A", "A9", `A${"b".repeat(62)}`, `A${"b".repeat(63)}`];
const RESERVED_VALUES = ["ac-", "ac-://X", "ac-secret9://X", "ac-secret:/X", "ac-SECRET://X", `ac-${"z".repeat(17)}://X`, "ac-secret://TOKEN\n"];
const INVALID_NAMES = ["", "9NAME", "NA-ME", "NA.ME", "NA ME", "NAMÉ", "NAME!", `A${"b".repeat(64)}`, "NAME/", "NA\nME"];

describe(SdlReferenceService.name, () => {
  describe("validate", () => {
    it("reports nothing for an sdl carrying no sdl references", () => {
      const { service } = setup();

      expect(service.validate(sdlWithEnv(["PORT=8080", "MODE=production"]))).toEqual([]);
    });

    it("reports an unknown kind naming the offending value", () => {
      const { service } = setup();

      const [error] = service.validate(sdlWithEnv(["TOKEN=ac-var://TOKEN"]));

      expect(error.message).toContain("ac-var://TOKEN");
      expect(error.message).toContain("var");
      expect(error.instancePath).toBe("/services/web/env/0");
    });

    it("reports a reserved value that is not a reference at all", () => {
      const { service } = setup();

      const [error] = service.validate(sdlWithEnv(["MODE=ac-dc"]));

      expect(error.message).toContain("ac-dc");
      expect(error.message).toContain("reserved");
    });

    it("reports nothing for a registered kind whose value it cannot see", () => {
      const { service } = setup();

      expect(service.validate(sdlWithEnv(["TOKEN=ac-secret://TOKEN"]))).toEqual([]);
    });

    it("reports every offending entry rather than only the first", () => {
      const { service } = setup();

      const errors = service.validate(sdlWithEnv(["A=ac-var://A", "B=ac-nope", "C=ac-secret://C"]));

      expect(errors).toHaveLength(2);
      expect(errors.map(error => error.instancePath)).toEqual(["/services/web/env/0", "/services/web/env/1"]);
    });

    it("reports nothing for an ordinary registry credential", () => {
      const { service } = setup();

      expect(service.validate(sdlWithCredentials({ username: faker.string.alphanumeric(10), password: faker.internet.password() }))).toEqual([]);
    });

    it("reports nothing for a registered kind referenced by a registry credential", () => {
      const { service } = setup();

      expect(service.validate(sdlWithCredentials({ username: "ac-secret://REG_USER", password: "ac-secret://REG_PASS" }))).toEqual([]);
    });

    it("reports a reserved value in a registry credential rather than letting it ship literally", () => {
      const { service } = setup();

      const [error] = service.validate(sdlWithCredentials({ password: "ac-dc-forever" }));

      expect(error.message).toContain("reserved");
      expect(error.instancePath).toBe("/services/web/credentials/password");
    });

    it("names the position rather than the value of a reserved registry credential, which is a secret whatever it holds", () => {
      const { service } = setup();
      const password = `ac-dc-${faker.internet.password()}`;

      const [error] = service.validate(sdlWithCredentials({ password }));

      expect(error.message).toContain("/services/web/credentials/password");
      expect(JSON.stringify(error)).not.toContain(password);
    });

    it("still quotes a reserved env value, which no rule makes a secret", () => {
      const { service } = setup();

      const [error] = service.validate(sdlWithEnv(["MODE=ac-dc-forever"]));

      expect(error.message).toContain("ac-dc-forever");
      expect(error.params.value).toBe("ac-dc-forever");
    });

    it("reports an unknown kind in a registry credential naming the half that carries it", () => {
      const { service } = setup();

      const [error] = service.validate(sdlWithCredentials({ username: "ac-var://REG_USER" }));

      expect(error.message).toContain("ac-var://REG_USER");
      expect(error.instancePath).toBe("/services/web/credentials/username");
    });

    it.each(["host", "email"] as const)("reports nothing for a reserved value in the credential %s, which carries no secret", field => {
      const { service } = setup();

      expect(service.validate(sdlWithCredentials({ [field]: "ac-dc-forever" }))).toEqual([]);
    });
  });

  describe("substitute", () => {
    it("sets the parsed env entry to the resolved value", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["DATABASE_URL=ac-secret://DATABASE_URL"]);

      const errors = service.substitute(sdl, { secrets: { DATABASE_URL: "postgres://u:p@host/db" } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.env).toEqual(["DATABASE_URL=postgres://u:p@host/db"]);
    });

    it("mutates the document it was given rather than returning a new one", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["TOKEN=ac-secret://TOKEN"]);
      const env = sdl.services.web.env;

      service.substitute(sdl, { secrets: { TOKEN: "resolved" } });

      expect(env).toBe(sdl.services.web.env);
      expect(env).toEqual(["TOKEN=resolved"]);
    });

    it("keeps a resolved value carrying yaml metacharacters byte-identical", () => {
      const { service } = setup();
      const value = "a: b #c |x >y {z} [w] &anchor *alias \"q\" 's'\nsecond: line\n\t- dash";
      const sdl = sdlWithEnv(["WEIRD=ac-secret://WEIRD"]);

      service.substitute(sdl, { secrets: { WEIRD: value } });

      expect(sdl.services.web.env).toEqual([`WEIRD=${value}`]);
    });

    it("keeps only the first equals sign as the separator", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["PAIR=ac-secret://PAIR"]);

      service.substitute(sdl, { secrets: { PAIR: "a=b=c" } });

      expect(sdl.services.web.env).toEqual(["PAIR=a=b=c"]);
    });

    it("leaves a reference inside a larger string untouched", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["MIXED=prefix ac-secret://TOKEN", 'QUOTED="ac-secret://TOKEN"', "LISTED=ac,ac-secret://TOKEN"]);

      const errors = service.substitute(sdl, { secrets: { TOKEN: "resolved" } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.env).toEqual(["MIXED=prefix ac-secret://TOKEN", 'QUOTED="ac-secret://TOKEN"', "LISTED=ac,ac-secret://TOKEN"]);
    });

    it("reports a value opening with a reference and trailing something else", () => {
      const { service } = setup();

      const [error] = service.substitute(sdlWithEnv(["SUFFIX=ac-secret://TOKEN suffix"]), { secrets: { TOKEN: "resolved" } });

      expect(error.message).toContain("reserved");
    });

    it("leaves an entry that declares no value untouched", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["ac-secret://TOKEN"]);

      const errors = service.substitute(sdl, { secrets: { TOKEN: "resolved" } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.env).toEqual(["ac-secret://TOKEN"]);
    });

    it("never resolves a resolved value that itself looks like a reference", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["A=ac-secret://A"]);

      const errors = service.substitute(sdl, { secrets: { A: "ac-secret://B", B: "leaked" } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.env).toEqual(["A=ac-secret://B"]);
      expect(JSON.stringify(sdl)).not.toContain("leaked");
    });

    it("reports a missing value naming the reference", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["TOKEN=ac-secret://TOKEN"]);

      const [error] = service.substitute(sdl, { secrets: {} });

      expect(error.message).toContain("ac-secret://TOKEN");
      expect(error.instancePath).toBe("/services/web/env/0");
      expect(sdl.services.web.env).toEqual(["TOKEN=ac-secret://TOKEN"]);
    });

    it("reports an unknown kind rather than resolving it", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["TOKEN=ac-var://TOKEN"]);

      const [error] = service.substitute(sdl, { secrets: { TOKEN: "resolved" } });

      expect(error.message).toContain("unknown SDL Reference kind");
      expect(sdl.services.web.env).toEqual(["TOKEN=ac-var://TOKEN"]);
    });

    it("gives every service that references one name the same value", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["TOKEN=ac-secret://TOKEN"], ["TOKEN=ac-secret://TOKEN"]);

      const errors = service.substitute(sdl, { secrets: { TOKEN: "shared" } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.env).toEqual(["TOKEN=shared"]);
      expect(sdl.services.worker.env).toEqual(["TOKEN=shared"]);
    });

    it("names the service a missing value was referenced from", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["TOKEN=ac-secret://TOKEN"], ["OTHER=ac-secret://OTHER"]);

      const [error] = service.substitute(sdl, { secrets: { TOKEN: "resolved" } });

      expect(error.message).toContain("ac-secret://OTHER");
      expect(error.message).toContain("worker");
      expect(error.instancePath).toBe("/services/worker/env/0");
      expect(sdl.services.worker.env).toEqual(["OTHER=ac-secret://OTHER"]);
    });

    it("resolves one service while another references nothing", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["TOKEN=ac-secret://TOKEN"], ["PORT=8080"]);

      const errors = service.substitute(sdl, { secrets: { TOKEN: "resolved" } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.env).toEqual(["TOKEN=resolved"]);
    });

    it.each(["constructor", "__proto__", "toString", "hasOwnProperty"])("reports a missing value for a service named %j", serviceName => {
      const { service } = setup();
      const sdl = yaml.raw<SDLInput>(sdlYaml(serviceYaml(serviceName, ["TOKEN=ac-secret://TOKEN"])));

      const [error] = service.substitute(sdl, { secrets: {} });

      expect(error.message).toContain(serviceName);
      expect(error.message).toContain("no value supplied");
    });

    it("bounds a very long service name in everything it echoes", () => {
      const { service } = setup();
      const sdl = yaml.raw<SDLInput>(sdlYaml(serviceYaml("s".repeat(500), ["TOKEN=ac-secret://TOKEN"])));

      const [error] = service.substitute(sdl, { secrets: {} });

      expect(error.message.length).toBeLessThan(300);
      expect(error.message).toContain(String(error.params.serviceName));
    });

    it.each([42, null, { nested: true }, ["array"], true])("refuses a resolver's non-string value %j", resolved => {
      const { service } = setup({ resolvers: [{ kind: "probe", resolve: () => resolved as unknown as string }] });
      const sdl = sdlWithEnv(["A=ac-probe://TOKEN"]);

      const [error] = service.substitute(sdl, { secrets: {} });

      expect(error.message).toContain("no value supplied");
      expect(sdl.services.web.env).toEqual(["A=ac-probe://TOKEN"]);
    });

    it("resolves a kind registered after construction", () => {
      const { service } = setup({ resolvers: [{ kind: "var", resolve: ({ name }) => `var-${name}` }] });
      const sdl = sdlWithEnv(["MODE=ac-var://MODE"]);

      const errors = service.substitute(sdl, { secrets: {} });

      expect(errors).toEqual([]);
      expect(sdl.services.web.env).toEqual(["MODE=var-MODE"]);
    });

    it("refuses to register a kind that is already registered", () => {
      const { service } = setup();

      expect(() => service.register({ kind: "secret", resolve: () => "displaced" })).toThrow("already registered");
    });

    it("reports a name spelling an Object.prototype member as missing", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["A=ac-secret://constructor"]);

      const [error] = service.substitute(sdl, { secrets: {} });

      expect(error.message).toContain("ac-secret://constructor");
      expect(sdl.services.web.env).toEqual(["A=ac-secret://constructor"]);
    });

    it("sets both halves of a registry credential to their resolved values", () => {
      const { service } = setup();
      const [username, password] = [faker.string.alphanumeric(10), faker.internet.password()];
      const sdl = sdlWithCredentials({ username: "ac-secret://REG_USER", password: "ac-secret://REG_PASS" });

      const errors = service.substitute(sdl, { secrets: { REG_USER: username, REG_PASS: password } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.credentials).toMatchObject({ username, password });
    });

    it("leaves the host and the email of a resolved credential alone", () => {
      const { service } = setup();
      const sdl = sdlWithCredentials({ password: "ac-secret://REG_PASS" });

      service.substitute(sdl, { secrets: { REG_PASS: faker.internet.password() } });

      expect(sdl.services.web.credentials).toMatchObject({ host: "registry.example.test", email: "ops@example.test" });
    });

    it("resolves a credential in every service that references it", () => {
      const { service } = setup();
      const sdl = sdlWithCredentials({ password: "ac-secret://REG_PASS" }, { password: "ac-secret://REG_PASS" });
      const password = faker.internet.password();

      const errors = service.substitute(sdl, { secrets: { REG_PASS: password } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.credentials!.password).toBe(password);
      expect(sdl.services.worker.credentials!.password).toBe(password);
    });

    it("quotes the reference of a credential it holds no value for, a reserved-prefix string being one no registry could accept anyway", () => {
      const { service } = setup();
      const sdl = sdlWithCredentials({ password: "ac-secret://REG_PASS" });

      const [error] = service.substitute(sdl, { secrets: {} });

      expect(error.message).toContain("ac-secret://REG_PASS");
      expect(error.instancePath).toBe("/services/web/credentials/password");
      expect(sdl.services.web.credentials!.password).toBe("ac-secret://REG_PASS");
    });

    it("reports a credential reference and an env reference of the same document", () => {
      const { service } = setup();
      const sdl = sdlWithCredentials({ password: "ac-secret://REG_PASS" }, undefined, ["TOKEN=ac-secret://TOKEN"]);

      const errors = service.substitute(sdl, { secrets: {} });

      expect(errors.map(error => error.instancePath)).toEqual(["/services/web/env/0", "/services/web/credentials/password"]);
    });

    it("resolves a credentials block two services share through a yaml anchor, never re-reading what it wrote", () => {
      const { service } = setup();
      const password = `ac-dc-${faker.internet.password()}`;
      const sdl = sdlSharingOneCredentialsBlock("ac-secret://REG_PASS");

      const errors = service.substitute(sdl, { secrets: { REG_PASS: password } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.credentials!.password).toBe(password);
      expect(sdl.services.worker.credentials!.password).toBe(password);
    });

    it("resolves an env list two services share through a yaml anchor, never re-reading what it wrote", () => {
      const { service } = setup();
      const value = `ac-dc-${faker.string.alphanumeric(16)}`;
      const sdl = sdlSharingOneEnvList("TOKEN=ac-secret://TOKEN");

      const errors = service.substitute(sdl, { secrets: { TOKEN: value } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.env).toEqual([`TOKEN=${value}`]);
      expect(sdl.services.worker.env).toEqual([`TOKEN=${value}`]);
    });

    it("ignores a service declaring no credentials at all", () => {
      const { service } = setup();

      expect(service.substitute(sdlWithEnv(["PORT=8080"]), { secrets: {} })).toEqual([]);
    });

    it("ignores a non-string env entry", () => {
      const { service } = setup();
      const sdl = sdlWithEnv([8080, null]);

      expect(service.substitute(sdl, { secrets: {} })).toEqual([]);
    });

    it("ignores a service declaring no env at all", () => {
      const { service } = setup();
      const sdl = yaml.raw<SDLInput>(sdlYaml("  web:\n    image: nginx\n"));

      expect(service.substitute(sdl, { secrets: {} })).toEqual([]);
    });

    it("ignores a document carrying no services", () => {
      const { service } = setup();

      expect(service.substitute(yaml.raw<SDLInput>('version: "2.0"\n'), { secrets: {} })).toEqual([]);
    });
  });

  describe("reference names", () => {
    it.each(VALID_NAMES)("resolves the name %j", name => {
      const { service } = setup();
      const sdl = sdlWithEnv([`A=ac-secret://${name}`]);

      const errors = service.substitute(sdl, { secrets: { [name]: "resolved" } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.env).toEqual(["A=resolved"]);
    });

    it.each(INVALID_NAMES)("rejects the name %j", name => {
      const { service } = setup();
      const reference = `ac-secret://${name}`;

      const [error] = service.substitute(sdlWithEnv([`A=${reference}`]), { secrets: { [name]: "resolved" } });

      expect(error.message).toContain("reserved");
    });

    it.each(RESERVED_VALUES)("rejects the reserved value %j", value => {
      const { service } = setup();

      const [error] = service.substitute(sdlWithEnv([`A=${value}`]), { secrets: { X: "resolved", TOKEN: "resolved" } });

      expect(error.message).toContain("reserved");
      expect(error.message).toContain(value);
    });

    it("bounds a very long reserved value in everything it echoes", () => {
      const { service } = setup();

      const [error] = service.substitute(sdlWithEnv([`A=ac-${"z".repeat(500)}`]), { secrets: {} });

      expect(error.message.length).toBeLessThan(250);
      expect(error.message).toContain(String(error.params.value));
    });

    it("treats names differing only in case as different names", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["UPPER=ac-secret://TOKEN", "LOWER=ac-secret://token"]);

      service.substitute(sdl, { secrets: { TOKEN: "upper", token: "lower" } });

      expect(sdl.services.web.env).toEqual(["UPPER=upper", "LOWER=lower"]);
    });

    it("reports a name whose case does not match the supplied one", () => {
      const { service } = setup();

      const [error] = service.substitute(sdlWithEnv(["A=ac-secret://token"]), { secrets: { TOKEN: "resolved" } });

      expect(error.message).toContain("ac-secret://token");
    });
  });

  describe(`MAX_SDL_REFERENCE_NAME_LENGTH`, () => {
    it("is the longest name the grammar accepts", () => {
      const { service } = setup();
      const longest = `A${"b".repeat(MAX_SDL_REFERENCE_NAME_LENGTH - 1)}`;

      expect(longest).toHaveLength(MAX_SDL_REFERENCE_NAME_LENGTH);
      expect(service.declarationsOf(sdlWithEnv([`T=ac-secret://${longest}`]), "secret").map(declaration => declaration.name)).toEqual([longest]);
    });

    it("is the shortest name the grammar refuses one longer than", () => {
      const { service } = setup();
      const tooLong = `A${"b".repeat(MAX_SDL_REFERENCE_NAME_LENGTH)}`;

      expect(service.declarationsOf(sdlWithEnv([`T=ac-secret://${tooLong}`]), "secret")).toEqual([]);
      expect(service.validate(sdlWithEnv([`T=ac-secret://${tooLong}`]))[0].message).toContain("reserved");
    });
  });

  describe("declarationsOf", () => {
    it("reports nothing for an sdl carrying no sdl references", () => {
      const { service } = setup();

      expect(service.declarationsOf(sdlWithEnv(["PORT=8080"]), "secret")).toEqual([]);
    });

    it("reports the name, the service and the whole reference of each declaration", () => {
      const { service } = setup();

      expect(service.declarationsOf(sdlWithEnv(["TOKEN=ac-secret://TOKEN"]), "secret")).toEqual([
        { kind: "secret", name: "TOKEN", serviceName: "web", reference: "ac-secret://TOKEN", instancePath: "/services/web/env/0" }
      ]);
    });

    it("reports one declaration per service that references the same name", () => {
      const { service } = setup();

      const declarations = service.declarationsOf(sdlWithEnv(["TOKEN=ac-secret://TOKEN"], ["TOKEN=ac-secret://TOKEN"]), "secret");

      expect(declarations.map(declaration => declaration.serviceName)).toEqual(["web", "worker"]);
    });

    it("reports one declaration per entry when a service references the same name twice", () => {
      const { service } = setup();

      const declarations = service.declarationsOf(sdlWithEnv(["A=ac-secret://TOKEN", "B=ac-secret://TOKEN"]), "secret");

      expect(declarations.map(declaration => declaration.instancePath)).toEqual(["/services/web/env/0", "/services/web/env/1"]);
    });

    it("reports only the kind it was asked about", () => {
      const { service } = setup({ resolvers: [{ kind: "probe", resolve: () => "resolved" }] });

      const declarations = service.declarationsOf(sdlWithEnv(["TOKEN=ac-secret://TOKEN", "MODE=ac-probe://MODE"]), "secret");

      expect(declarations.map(declaration => declaration.name)).toEqual(["TOKEN"]);
    });

    it("reports nothing for a value that merely opens with the reserved prefix", () => {
      const { service } = setup();

      expect(service.declarationsOf(sdlWithEnv(["MODE=ac-dc"]), "secret")).toEqual([]);
    });

    it("reports nothing for a reference embedded in a larger value", () => {
      const { service } = setup();

      expect(service.declarationsOf(sdlWithEnv(["TOKEN=prefix-ac-secret://TOKEN"]), "secret")).toEqual([]);
    });

    it("reports a name spelling an Object.prototype member as an ordinary name", () => {
      const { service } = setup();

      expect(service.declarationsOf(sdlWithEnv(["C=ac-secret://constructor"]), "secret").map(declaration => declaration.name)).toEqual(["constructor"]);
    });

    it("reports one declaration per service for a credentials block the two of them share", () => {
      const { service } = setup();

      const declarations = service.declarationsOf(sdlSharingOneCredentialsBlock("ac-secret://REG_PASS"), "secret");

      expect(declarations.map(declaration => declaration.instancePath)).toEqual([
        "/services/web/credentials/password",
        "/services/worker/credentials/password"
      ]);
    });

    it("reports a registry credential declaration with the half that carries it", () => {
      const { service } = setup();

      expect(service.declarationsOf(sdlWithCredentials({ password: "ac-secret://REG_PASS" }), "secret")).toEqual([
        { kind: "secret", name: "REG_PASS", serviceName: "web", reference: "ac-secret://REG_PASS", instancePath: "/services/web/credentials/password" }
      ]);
    });

    it("reports one declaration per credential half", () => {
      const { service } = setup();

      const declarations = service.declarationsOf(sdlWithCredentials({ username: "ac-secret://REG_USER", password: "ac-secret://REG_PASS" }), "secret");

      expect(declarations.map(declaration => declaration.name)).toEqual(["REG_USER", "REG_PASS"]);
    });
  });

  describe("hasAnyReference", () => {
    it("reports none for an sdl whose values are all plain", () => {
      const { service } = setup();

      expect(service.hasAnyReference(sdlWithEnv(["PORT=8080", "MODE=production"]))).toBe(false);
    });

    it("reports one for an env value that is a reference", () => {
      const { service } = setup();

      expect(service.hasAnyReference(sdlWithEnv(["TOKEN=ac-secret://TOKEN"]))).toBe(true);
    });

    it("reports one for a registry credential that is a reference", () => {
      const { service } = setup();

      expect(service.hasAnyReference(sdlWithCredentials({ password: "ac-secret://REG_PASS" }))).toBe(true);
    });

    it("reports one for a reference of a kind nothing resolves", () => {
      const { service } = setup();

      expect(service.hasAnyReference(sdlWithEnv(["TOKEN=ac-var://TOKEN"]))).toBe(true);
    });

    it.each(RESERVED_VALUES)("reports one for the reserved value %j, which stands where a reference stands", value => {
      const { service } = setup();

      expect(service.hasAnyReference(sdlWithEnv([`MODE=${value}`]))).toBe(true);
    });

    it("reports none for an sdl with no services at all", () => {
      const { service } = setup();

      expect(service.hasAnyReference(yaml.raw<SDLInput>(`version: "2.0"`))).toBe(false);
    });
  });

  function setup(input: { resolvers?: SdlReferenceResolver[] } = {}) {
    const service = new SdlReferenceService();
    input.resolvers?.forEach(resolver => service.register(resolver));

    return { service };
  }

  function sdlWithEnv(webEnv: unknown[], workerEnv?: unknown[]) {
    const services = [serviceYaml("web", webEnv), workerEnv ? serviceYaml("worker", workerEnv) : ""].join("");

    return yaml.raw<SDLInput>(sdlYaml(services));
  }

  function sdlWithCredentials(webCredentials: Record<string, string>, workerCredentials?: Record<string, string>, webEnv: unknown[] = []) {
    const services = [serviceYaml("web", webEnv, webCredentials), workerCredentials ? serviceYaml("worker", [], workerCredentials) : ""].join("");

    return yaml.raw<SDLInput>(sdlYaml(services));
  }

  function sdlSharingOneCredentialsBlock(password: string) {
    const block = credentialsYaml({ password }).replace("    credentials:\n", "");

    return yaml.raw<SDLInput>(
      sdlYaml(`  web:\n    image: nginx\n    credentials: &registry\n${block}  worker:\n    image: nginx\n    credentials: *registry\n`)
    );
  }

  function sdlSharingOneEnvList(entry: string) {
    return yaml.raw<SDLInput>(
      sdlYaml(`  web:\n    image: nginx\n    env: &shared\n      - ${JSON.stringify(entry)}\n  worker:\n    image: nginx\n    env: *shared\n`)
    );
  }

  function credentialsYaml(overrides: Record<string, string>) {
    const credentials = {
      host: "registry.example.test",
      email: "ops@example.test",
      username: faker.string.alphanumeric(10),
      password: faker.internet.password(),
      ...overrides
    };

    return `    credentials:\n${Object.entries(credentials)
      .map(([field, value]) => `      ${field}: ${JSON.stringify(value)}\n`)
      .join("")}`;
  }

  function serviceYaml(name: string, env: unknown[], credentials?: Record<string, string>) {
    const entries = env.map(entry => `      - ${JSON.stringify(entry)}\n`).join("");
    const envYaml = env.length > 0 ? `    env:\n${entries}` : "";

    return `  ${name}:\n    image: nginx\n${envYaml}${credentials ? credentialsYaml(credentials) : ""}`;
  }

  function sdlYaml(services: string) {
    return `version: "2.0"\nservices:\n${services}`;
  }
});
