import type { SDLInput } from "@akashnetwork/chain-sdk";
import { describe, expect, it } from "vitest";

import { MAX_ECHOED_REFERENCE_LENGTH, SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { SdlPatchService } from "./sdl-patch.service";

describe(SdlPatchService.name, () => {
  it("replaces the image of the named service", () => {
    const { service, document } = setup({ services: { web: { image: "nginx" } } });

    service.apply(document, { web: { image: "nginx:1.27" } });

    expect(document.services.web.image).toBe("nginx:1.27");
  });

  it("replaces command and args", () => {
    const { service, document } = setup({ services: { web: { image: "nginx", command: ["sh"], args: ["-c", "old"] } } });

    service.apply(document, { web: { command: ["bash"], args: ["-c", "new"] } });

    expect(document.services.web.command).toEqual(["bash"]);
    expect(document.services.web.args).toEqual(["-c", "new"]);
  });

  it("clears command and args given null", () => {
    const { service, document } = setup({ services: { web: { image: "nginx", command: ["sh"], args: ["-c", "old"] } } });

    service.apply(document, { web: { command: null, args: null } });

    expect(document.services.web.command).toBeNull();
    expect(document.services.web.args).toBeNull();
  });

  it("leaves a field the patch does not name", () => {
    const { service, document } = setup({ services: { web: { image: "nginx", command: ["sh"] } } });

    service.apply(document, { web: { image: "nginx:1.27" } });

    expect(document.services.web.command).toEqual(["sh"]);
  });

  it("leaves a service the patch does not name", () => {
    const { service, document } = setup({ services: { web: { image: "nginx" }, worker: { image: "busybox" } } });

    service.apply(document, { web: { image: "nginx:1.27" } });

    expect(document.services.worker.image).toBe("busybox");
  });

  describe("env", () => {
    it("rewrites a named variable at the index it already occupies", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one", "B=two", "C=three"] } } });

      service.apply(document, { web: { env: { B: "replaced" } } });

      expect(document.services.web.env).toEqual(["A=one", "B=replaced", "C=three"]);
    });

    it("appends a variable the service did not declare", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one"] } } });

      service.apply(document, { web: { env: { B: "two" } } });

      expect(document.services.web.env).toEqual(["A=one", "B=two"]);
    });

    it("removes a variable given null", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one", "B=two", "C=three"] } } });

      service.apply(document, { web: { env: { B: null } } });

      expect(document.services.web.env).toEqual(["A=one", "C=three"]);
    });

    it("ignores a removal of a variable the service never declared", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one"] } } });

      service.apply(document, { web: { env: { NOPE: null } } });

      expect(document.services.web.env).toEqual(["A=one"]);
    });

    it("drops the env key entirely once the last variable is removed", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one"] } } });

      service.apply(document, { web: { env: { A: null } } });

      expect("env" in document.services.web).toBe(false);
    });

    it("adds env to a service that declared none", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" } } });

      service.apply(document, { web: { env: { A: "one" } } });

      expect(document.services.web.env).toEqual(["A=one"]);
    });

    it("treats an entry with no assignment as its own name and gives it a value", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["INHERITED_FROM_HOST"] } } });

      service.apply(document, { web: { env: { INHERITED_FROM_HOST: "explicit" } } });

      expect(document.services.web.env).toEqual(["INHERITED_FROM_HOST=explicit"]);
    });

    it("keeps a reference standing at a variable the patch does not name", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=ac-secret://s0_e0", "B=two"] } } });

      service.apply(document, { web: { env: { B: "replaced" } } });

      expect(document.services.web.env).toEqual(["A=ac-secret://s0_e0", "B=replaced"]);
    });

    it("overwrites the reference standing at a variable the patch does name, at the same index", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one", "B=ac-secret://s0_e1"] } } });

      service.apply(document, { web: { env: { B: "supplied" } } });

      expect(document.services.web.env).toEqual(["A=one", "B=supplied"]);
    });

    it("keeps a value carrying an equals sign intact", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one"] } } });

      service.apply(document, { web: { env: { A: "k=v=w" } } });

      expect(document.services.web.env).toEqual(["A=k=v=w"]);
    });
  });

  describe("credentials", () => {
    it("replaces the three fields it carries", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx", credentials: { host: "old.test", username: "old", password: "old" } } }
      });

      service.apply(document, { web: { credentials: { host: "new.test", username: "new", password: "rotated" } } });

      expect(document.services.web.credentials).toEqual({ host: "new.test", username: "new", password: "rotated" });
    });

    it("keeps the email the patch schema has no field for", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx", credentials: { host: "r.test", username: "old", password: "old", email: "keep@r.test" } } }
      });

      service.apply(document, { web: { credentials: { host: "r.test", username: "new", password: "rotated" } } });

      expect(document.services.web.credentials?.email).toBe("keep@r.test");
    });

    it("clears the credentials given null", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx", credentials: { host: "r.test", username: "u", password: "p" } } }
      });

      service.apply(document, { web: { credentials: null } });

      expect("credentials" in document.services.web).toBe(false);
    });

    it("adds credentials to a service that declared none", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" } } });

      service.apply(document, { web: { credentials: { host: "r.test", username: "u", password: "p" } } });

      expect(document.services.web.credentials).toEqual({ host: "r.test", username: "u", password: "p" });
    });
  });

  describe("the positions it reports having written", () => {
    it("reports the env position it rewrote", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one", "B=two"] } } });

      const written = service.apply(document, { web: { env: { B: "replaced" } } });

      expect([...written]).toEqual(["/services/web/env/1"]);
    });

    it("reports the env position it appended", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one"] } } });

      const written = service.apply(document, { web: { env: { B: "two" } } });

      expect([...written]).toEqual(["/services/web/env/1"]);
    });

    it("reports the shifted position of a variable it wrote beside one it removed", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one", "B=two", "C=three"] } } });

      const written = service.apply(document, { web: { env: { A: null, C: "rewritten" } } });

      expect(document.services.web.env).toEqual(["B=two", "C=rewritten"]);
      expect([...written]).toEqual(["/services/web/env/1"]);
    });

    it("reports nothing for a variable it removed", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one"] } } });

      const written = service.apply(document, { web: { env: { A: null } } });

      expect([...written]).toEqual([]);
    });

    it("reports both halves of a credential it wrote, and not the host", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" } } });

      const written = service.apply(document, { web: { credentials: { host: "r.test", username: "u", password: "p" } } });

      expect([...written].sort()).toEqual(["/services/web/credentials/password", "/services/web/credentials/username"]);
    });

    it("reports nothing for credentials it cleared", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx", credentials: { host: "r.test", username: "u", password: "p" } } }
      });

      const written = service.apply(document, { web: { credentials: null } });

      expect([...written]).toEqual([]);
    });

    it("reports nothing for a patch that touches no value position", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one"] } } });

      const written = service.apply(document, { web: { image: "nginx:1.27" } });

      expect([...written]).toEqual([]);
    });

    it("reports only the service it was asked to patch", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx", env: ["A=one"] }, worker: { image: "busybox", env: ["B=two"] } }
      });

      const written = service.apply(document, { web: { env: { A: "changed" } } });

      expect([...written]).toEqual(["/services/web/env/0"]);
    });

    it("spells a position the way the sdl reference walk spells it", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one"] } } });

      const written = service.apply(document, { web: { env: { A: "changed" } } });

      const slots = new SdlReferenceService().slotsOf(document).map(slot => slot.instancePath);
      expect(slots).toEqual(expect.arrayContaining([...written]));
    });
  });

  describe("a key the deployment does not have", () => {
    it("refuses a service the sdl does not declare, naming it", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" } } });

      expect(() => service.apply(document, { api: { image: "nginx" } })).toThrow(/"api" is not a service of this deployment/);
    });

    it("refuses with a 400", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" } } });

      expect(() => service.apply(document, { api: { image: "nginx" } })).toThrow(expect.objectContaining({ status: 400 }));
    });

    it("refuses a service name spelling an object prototype member rather than resolving one", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" } } });

      expect(() => service.apply(document, { constructor: { image: "nginx" } })).toThrow(/is not a service of this deployment/);
    });

    it("changes nothing when a later service in the same patch is unknown", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" } } });

      expect(() => service.apply(document, { api: { image: "x" }, web: { image: "nginx:1.27" } })).toThrow();
      expect(document.services.web.image).toBe("nginx");
    });

    it("bounds how much of an outsized service name it echoes", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" } } });
      const outsized = "n".repeat(500);

      expect(() => service.apply(document, { [outsized]: { image: "nginx" } })).toThrow(
        `"${"n".repeat(MAX_ECHOED_REFERENCE_LENGTH)}" is not a service of this deployment`
      );
    });
  });

  describe("a node two services share through a yaml anchor", () => {
    it("refuses to patch env through a shared list", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" }, worker: { image: "busybox" } }, shareEnv: ["A=one"] });

      expect(() => service.apply(document, { web: { env: { A: "two" } } })).toThrow(/share its env with another service/);
    });

    it("leaves the shared list untouched when it refuses", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" }, worker: { image: "busybox" } }, shareEnv: ["A=one"] });

      expect(() => service.apply(document, { web: { env: { A: "two" } } })).toThrow();
      expect(document.services.worker.env).toEqual(["A=one"]);
    });

    it("refuses to patch credentials through a shared block", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx" }, worker: { image: "busybox" } },
        shareCredentials: { host: "r.test", username: "u", password: "p" }
      });

      expect(() => service.apply(document, { web: { credentials: { host: "r.test", username: "u", password: "rotated" } } })).toThrow(
        /share its credentials with another service/
      );
    });

    it("still patches a field that does not reach the shared node", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" }, worker: { image: "busybox" } }, shareEnv: ["A=one"] });

      service.apply(document, { web: { image: "nginx:1.27" } });

      expect(document.services.web.image).toBe("nginx:1.27");
    });

    it("patches an env list only one service reaches", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one"] }, worker: { image: "busybox", env: ["A=one"] } } });

      service.apply(document, { web: { env: { A: "two" } } });

      expect(document.services.web.env).toEqual(["A=two"]);
      expect(document.services.worker.env).toEqual(["A=one"]);
    });
  });

  function setup(input: {
    services: Record<string, SDLInput["services"][string]>;
    shareEnv?: string[];
    shareCredentials?: NonNullable<SDLInput["services"][string]["credentials"]>;
  }) {
    const services = { ...input.services };

    for (const name of Object.keys(services)) {
      if (input.shareEnv) services[name] = { ...services[name], env: input.shareEnv };
      if (input.shareCredentials) services[name] = { ...services[name], credentials: input.shareCredentials };
    }

    const document: SDLInput = {
      version: "2.0",
      services,
      profiles: { compute: {}, placement: {} },
      deployment: {}
    };

    return { service: new SdlPatchService(), document };
  }
});
