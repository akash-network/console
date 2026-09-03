import type { SDLInput } from "@akashnetwork/chain-sdk";
import { yaml } from "@akashnetwork/chain-sdk";
import { describe, expect, it } from "vitest";

import type { NamespacedSdlSecrets, SdlReferenceResolver } from "./sdl-reference.service";
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
  });

  describe("substitute", () => {
    it("sets the parsed env entry to the resolved value", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["DATABASE_URL=ac-secret://DATABASE_URL"]);

      const errors = service.substitute(sdl, { secrets: { web: { DATABASE_URL: "postgres://u:p@host/db" } } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.env).toEqual(["DATABASE_URL=postgres://u:p@host/db"]);
    });

    it("mutates the document it was given rather than returning a new one", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["TOKEN=ac-secret://TOKEN"]);
      const env = sdl.services.web.env;

      service.substitute(sdl, { secrets: { web: { TOKEN: "resolved" } } });

      expect(env).toBe(sdl.services.web.env);
      expect(env).toEqual(["TOKEN=resolved"]);
    });

    it("keeps a resolved value carrying yaml metacharacters byte-identical", () => {
      const { service } = setup();
      const value = "a: b #c |x >y {z} [w] &anchor *alias \"q\" 's'\nsecond: line\n\t- dash";
      const sdl = sdlWithEnv(["WEIRD=ac-secret://WEIRD"]);

      service.substitute(sdl, { secrets: { web: { WEIRD: value } } });

      expect(sdl.services.web.env).toEqual([`WEIRD=${value}`]);
    });

    it("keeps only the first equals sign as the separator", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["PAIR=ac-secret://PAIR"]);

      service.substitute(sdl, { secrets: { web: { PAIR: "a=b=c" } } });

      expect(sdl.services.web.env).toEqual(["PAIR=a=b=c"]);
    });

    it("leaves a reference inside a larger string untouched", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["MIXED=prefix ac-secret://TOKEN", 'QUOTED="ac-secret://TOKEN"', "LISTED=ac,ac-secret://TOKEN"]);

      const errors = service.substitute(sdl, { secrets: { web: { TOKEN: "resolved" } } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.env).toEqual(["MIXED=prefix ac-secret://TOKEN", 'QUOTED="ac-secret://TOKEN"', "LISTED=ac,ac-secret://TOKEN"]);
    });

    it("reports a value opening with a reference and trailing something else", () => {
      const { service } = setup();

      const [error] = service.substitute(sdlWithEnv(["SUFFIX=ac-secret://TOKEN suffix"]), { secrets: { web: { TOKEN: "resolved" } } });

      expect(error.message).toContain("reserved");
    });

    it("leaves an entry that declares no value untouched", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["ac-secret://TOKEN"]);

      const errors = service.substitute(sdl, { secrets: { web: { TOKEN: "resolved" } } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.env).toEqual(["ac-secret://TOKEN"]);
    });

    it("never resolves a resolved value that itself looks like a reference", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["A=ac-secret://A"]);

      const errors = service.substitute(sdl, { secrets: { web: { A: "ac-secret://B", B: "leaked" } } });

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

      const [error] = service.substitute(sdl, { secrets: { web: { TOKEN: "resolved" } } });

      expect(error.message).toContain("unknown SDL Reference kind");
      expect(sdl.services.web.env).toEqual(["TOKEN=ac-var://TOKEN"]);
    });

    it("gives each service its own value for the same name", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["TOKEN=ac-secret://TOKEN"], ["TOKEN=ac-secret://TOKEN"]);

      const errors = service.substitute(sdl, { secrets: { web: { TOKEN: "web-value" }, worker: { TOKEN: "worker-value" } } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.env).toEqual(["TOKEN=web-value"]);
      expect(sdl.services.worker.env).toEqual(["TOKEN=worker-value"]);
    });

    it("reports a name one service supplies and another does not, naming the service that lacks it", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["TOKEN=ac-secret://TOKEN"], ["TOKEN=ac-secret://TOKEN"]);

      const [error] = service.substitute(sdl, { secrets: { web: { TOKEN: "web-value" } } });

      expect(error.message).toContain("ac-secret://TOKEN");
      expect(error.message).toContain("worker");
      expect(error.instancePath).toBe("/services/worker/env/0");
      expect(sdl.services.worker.env).toEqual(["TOKEN=ac-secret://TOKEN"]);
    });

    it("resolves one service while another service supplies no namespace at all", () => {
      const { service } = setup();
      const sdl = sdlWithEnv(["TOKEN=ac-secret://TOKEN"], ["PORT=8080"]);

      const errors = service.substitute(sdl, { secrets: { web: { TOKEN: "web-value" } } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.env).toEqual(["TOKEN=web-value"]);
    });

    it.each(["constructor", "__proto__", "toString", "hasOwnProperty"])("reports a missing namespace for the service name %j", serviceName => {
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

    it.each([{ web: "supersecret" }, { web: ["item"] }])("reports a missing value for the non-object namespace %j", secrets => {
      const { service } = setup();
      const sdl = sdlWithEnv(["A=ac-secret://length"]);

      const [error] = service.substitute(sdl, { secrets: secrets as unknown as NamespacedSdlSecrets });

      expect(error.message).toContain("no value supplied");
      expect(sdl.services.web.env).toEqual(["A=ac-secret://length"]);
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

      const errors = service.substitute(sdl, { secrets: { web: { [name]: "resolved" } } });

      expect(errors).toEqual([]);
      expect(sdl.services.web.env).toEqual(["A=resolved"]);
    });

    it.each(INVALID_NAMES)("rejects the name %j", name => {
      const { service } = setup();
      const reference = `ac-secret://${name}`;

      const [error] = service.substitute(sdlWithEnv([`A=${reference}`]), { secrets: { web: { [name]: "resolved" } } });

      expect(error.message).toContain("reserved");
    });

    it.each(RESERVED_VALUES)("rejects the reserved value %j", value => {
      const { service } = setup();

      const [error] = service.substitute(sdlWithEnv([`A=${value}`]), { secrets: { web: { X: "resolved", TOKEN: "resolved" } } });

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

      service.substitute(sdl, { secrets: { web: { TOKEN: "upper", token: "lower" } } });

      expect(sdl.services.web.env).toEqual(["UPPER=upper", "LOWER=lower"]);
    });

    it("reports a name whose case does not match the supplied one", () => {
      const { service } = setup();

      const [error] = service.substitute(sdlWithEnv(["A=ac-secret://token"]), { secrets: { web: { TOKEN: "resolved" } } });

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

  function serviceYaml(name: string, env: unknown[]) {
    const entries = env.map(entry => `      - ${JSON.stringify(entry)}\n`).join("");

    return `  ${name}:\n    image: nginx\n    env:\n${entries}`;
  }

  function sdlYaml(services: string) {
    return `version: "2.0"\nservices:\n${services}`;
  }
});
