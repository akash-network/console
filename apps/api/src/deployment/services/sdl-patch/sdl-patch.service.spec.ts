import type { SDLInput } from "@akashnetwork/chain-sdk";
import { describe, expect, it } from "vitest";

import { MAX_ECHOED_REFERENCE_LENGTH, SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { SdlPatchService } from "./sdl-patch.service";

type SdlExposeEntry = NonNullable<SDLInput["services"][string]["expose"]>[number];

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

  it("removes command and args given null, rather than storing a null the user never wrote", () => {
    const { service, document } = setup({ services: { web: { image: "nginx", command: ["sh"], args: ["-c", "old"] } } });

    service.apply(document, { web: { command: null, args: null } });

    expect("command" in document.services.web).toBe(false);
    expect("args" in document.services.web).toBe(false);
  });

  it("leaves a command the patch does not name", () => {
    const { service, document } = setup({ services: { web: { image: "nginx", command: ["sh"] } } });

    service.apply(document, { web: { args: ["-c", "new"] } });

    expect(document.services.web.command).toEqual(["sh"]);
  });

  it("clears a command on a service that never declared one without adding the key", () => {
    const { service, document } = setup({ services: { web: { image: "nginx" } } });

    service.apply(document, { web: { command: null } });

    expect("command" in document.services.web).toBe(false);
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
    it("moves a patched variable to the end, since nothing downstream depends on where it sits", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one", "B=two", "C=three"] } } });

      service.apply(document, { web: { env: { B: "replaced" } } });

      expect(document.services.web.env).toEqual(["A=one", "C=three", "B=replaced"]);
    });

    it("leaves the variables it did not name carrying exactly the text they carried", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=ac-secret://s0_e0", "B=two", "C=ac-secret://s0_e2"] } } });

      service.apply(document, { web: { env: { B: "replaced" } } });

      expect(document.services.web.env).toEqual(["A=ac-secret://s0_e0", "C=ac-secret://s0_e2", "B=replaced"]);
    });

    it("leaves the stored list standing given an empty record", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one", "B=two"] } } });
      const stored = document.services.web.env;

      service.apply(document, { web: { env: {} } });

      expect(document.services.web.env).toBe(stored);
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

    it("leaves a non-string entry alone, since it is not ours to remove", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one", 42 as unknown as string, "B=two"] } } });

      service.apply(document, { web: { env: { B: "replaced" } } });

      expect(document.services.web.env).toEqual(["A=one", 42, "B=replaced"]);
    });

    it("removes every occurrence of a cleared key and appends nothing", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["FOO=one", "BAR=two", "FOO=three"] } } });

      service.apply(document, { web: { env: { FOO: null } } });

      expect(document.services.web.env).toEqual(["BAR=two"]);
    });

    it("records the appended index when one call both removes and adds", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one", "B=two", "C=three"] } } });

      const written = service.apply(document, { web: { env: { A: null, B: "replaced" } } });

      expect(document.services.web.env).toEqual(["C=three", "B=replaced"]);
      expect([...written]).toEqual(["/services/web/env/1"]);
    });

    it("records an index that really addresses the appended entry", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one", "B=two"] } } });

      const written = service.apply(document, { web: { env: { A: "replaced" } } });

      const [path] = [...written];
      const index = Number(path.split("/").pop());
      expect(document.services.web.env?.[index]).toBe("A=replaced");
    });

    it("keeps a value carrying an equals sign intact", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one"] } } });

      service.apply(document, { web: { env: { A: "k=v=w" } } });

      expect(document.services.web.env).toEqual(["A=k=v=w"]);
    });
  });

  describe("an env key the stored document declares more than once", () => {
    it("collapses a key the document declared twice into the single entry it appends", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["FOO=one", "BAR=two", "FOO=three"] } } });

      service.apply(document, { web: { env: { FOO: "replaced" } } });

      expect(document.services.web.env).toEqual(["BAR=two", "FOO=replaced"]);
    });

    it("removes every occurrence given null", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["FOO=one", "BAR=two", "FOO=three"] } } });

      service.apply(document, { web: { env: { FOO: null } } });

      expect(document.services.web.env).toEqual(["BAR=two"]);
    });

    it("reports the one position the collapsed entry ended up at", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["FOO=one", "BAR=two", "FOO=three"] } } });

      const written = service.apply(document, { web: { env: { FOO: "replaced" } } });

      expect([...written]).toEqual(["/services/web/env/1"]);
    });
  });

  describe("a whole service definition two names share", () => {
    it("refuses an image patch through the alias rather than rewriting both", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" } }, aliasWebAs: "worker" });

      expect(() => service.apply(document, { web: { image: "nginx:1.27" } })).toThrow(/share its definition with another part of the document/);
    });

    it("leaves the aliased service untouched", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" } }, aliasWebAs: "worker" });

      expect(() => service.apply(document, { web: { image: "nginx:1.27" } })).toThrow();
      expect(document.services.worker.image).toBe("nginx");
    });

    it("accepts a patch naming no field, rather than refusing a write it would never make", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" } }, aliasWebAs: "worker" });

      service.apply(document, { web: {} });

      expect(document.services.worker.image).toBe("nginx");
    });

    it("accepts a patch whose only sub-patch assigns nothing", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", expose: [{ port: 80, accept: ["a.test"] }] } }, aliasWebAs: "worker" });

      service.apply(document, { web: { expose: { "80": {} } } });

      expect(document.services.worker.expose?.[0].accept).toEqual(["a.test"]);
    });

    it("still refuses a sub-patch that does assign through the alias", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", expose: [{ port: 80, accept: ["a.test"] }] } }, aliasWebAs: "worker" });

      expect(() => service.apply(document, { web: { expose: { "80": { accept: ["b.test"] } } } })).toThrow(
        /share its definition with another part of the document/
      );
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
    it("reports the env position it appended", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", env: ["A=one"] } } });

      const written = service.apply(document, { web: { env: { B: "two" } } });

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

    it("bounds how much of an outsized service name it echoes", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" } } });
      const outsized = "n".repeat(500);

      expect(() => service.apply(document, { [outsized]: { image: "nginx" } })).toThrow(
        `"${"n".repeat(MAX_ECHOED_REFERENCE_LENGTH)}" is not a service of this deployment`
      );
    });
  });

  describe("expose", () => {
    it("replaces the accepted hosts of the named port", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", expose: [{ port: 80, accept: ["old.test"] }] } } });

      service.apply(document, { web: { expose: { "80": { accept: ["new.test", "www.new.test"] } } } });

      expect(document.services.web.expose?.[0].accept).toEqual(["new.test", "www.new.test"]);
    });

    it("matches the port the endpoint declares rather than its position", () => {
      const { service, document } = setup({
        services: {
          web: {
            image: "nginx",
            expose: [
              { port: 80, accept: ["a.test"] },
              { port: 8080, accept: ["b.test"] }
            ]
          }
        }
      });

      service.apply(document, { web: { expose: { "8080": { accept: ["patched.test"] } } } });

      expect(document.services.web.expose?.[0].accept).toEqual(["a.test"]);
      expect(document.services.web.expose?.[1].accept).toEqual(["patched.test"]);
    });

    it("translates every camelCase http option onto the snake_case key the sdl names", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", expose: [{ port: 80 }] } } });

      service.apply(document, {
        web: {
          expose: {
            "80": {
              httpOptions: { maxBodySize: 2048, readTimeout: 1000, sendTimeout: 2000, nextTries: 3, nextTimeout: 4000, nextCases: ["500", "timeout"] }
            }
          }
        }
      });

      expect(document.services.web.expose?.[0].http_options).toEqual({
        max_body_size: 2048,
        read_timeout: 1000,
        send_timeout: 2000,
        next_tries: 3,
        next_timeout: 4000,
        next_cases: ["500", "timeout"]
      });
    });

    it("merges http options over the ones already declared", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx", expose: [{ port: 80, http_options: { max_body_size: 1024, read_timeout: 5000 } }] } }
      });

      service.apply(document, { web: { expose: { "80": { httpOptions: { readTimeout: 9000 } } } } });

      expect(document.services.web.expose?.[0].http_options).toEqual({ max_body_size: 1024, read_timeout: 9000 });
    });

    it("leaves the endpoint kind and count alone while patching its hosts", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx", expose: [{ port: 80, as: 80, proto: "TCP", to: [{ global: true }], accept: ["old.test"] }] } }
      });

      service.apply(document, { web: { expose: { "80": { accept: ["new.test"] } } } });

      expect(document.services.web.expose?.[0]).toMatchObject({ port: 80, as: 80, proto: "TCP", to: [{ global: true }] });
    });

    it("refuses a port the service does not expose, naming it", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", expose: [{ port: 80 }] } } });

      expect(() => service.apply(document, { web: { expose: { "8080": { accept: ["x.test"] } } } })).toThrow(/service "web" exposes no port "8080"/);
    });

    it("refuses a port on a service exposing nothing at all", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" } } });

      expect(() => service.apply(document, { web: { expose: { "80": { accept: ["x.test"] } } } })).toThrow(/exposes no port "80"/);
    });

    it("changes nothing when a later port in the same patch is unknown", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", expose: [{ port: 80, accept: ["old.test"] }] } } });

      expect(() => service.apply(document, { web: { expose: { "8080": { accept: ["x.test"] } } } })).toThrow();
      expect(document.services.web.expose?.[0].accept).toEqual(["old.test"]);
    });

    it('refuses a port spelled "undefined" rather than matching an endpoint that declares none', () => {
      const { service, document } = setup({ services: { web: { image: "nginx", expose: [{ accept: ["old.test"] } as SdlExposeEntry] } } });

      expect(() => service.apply(document, { web: { expose: { undefined: { accept: ["x.test"] } } } })).toThrow(/exposes no port "undefined"/);
      expect(document.services.web.expose?.[0].accept).toEqual(["old.test"]);
    });

    it("still refuses an unknown port carrying a sub-patch that assigns nothing", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", expose: [{ port: 80 }] } } });

      expect(() => service.apply(document, { web: { expose: { "8080": {} } } })).toThrow(/exposes no port "8080"/);
    });

    it("writes no http options node for a sub-patch that assigns nothing", () => {
      const { service, document } = setup({ services: { web: { image: "nginx", expose: [{ port: 80 }] } } });

      service.apply(document, { web: { expose: { "80": {} } } });

      expect(document.services.web.expose?.[0]).toEqual({ port: 80 });
    });
  });

  describe("storage", () => {
    it("moves the mount point of the named volume", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx", params: { storage: { data: { mount: "/old", readOnly: false } } } } }
      });

      service.apply(document, { web: { storage: { data: { mount: "/srv/data" } } } });

      expect(document.services.web.params?.storage?.data).toEqual({ mount: "/srv/data", readOnly: false });
    });

    it("sets the read-only flag of the named volume", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx", params: { storage: { data: { mount: "/srv/data", readOnly: false } } } } }
      });

      service.apply(document, { web: { storage: { data: { readOnly: true } } } });

      expect(document.services.web.params?.storage?.data.readOnly).toBe(true);
    });

    it("leaves a volume the patch does not name", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx", params: { storage: { data: { mount: "/data" }, cache: { mount: "/cache" } } } } }
      });

      service.apply(document, { web: { storage: { data: { mount: "/srv/data" } } } });

      expect(document.services.web.params?.storage?.cache).toEqual({ mount: "/cache" });
    });

    it("refuses a volume the service does not declare, naming it", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx", params: { storage: { data: { mount: "/data" } } } } }
      });

      expect(() => service.apply(document, { web: { storage: { nope: { mount: "/nope" } } } })).toThrow(/service "web" declares no storage volume "nope"/);
    });

    it("refuses a volume on a service declaring no storage at all", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" } } });

      expect(() => service.apply(document, { web: { storage: { data: { mount: "/data" } } } })).toThrow(/declares no storage volume "data"/);
    });

    it("refuses a volume name spelling an object prototype member rather than resolving one", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx", params: { storage: { data: { mount: "/data" } } } } }
      });

      expect(() => service.apply(document, { web: { storage: { constructor: { mount: "/x" } } } })).toThrow(/declares no storage volume/);
    });
  });

  describe("a node two services share through a yaml anchor", () => {
    it("refuses to patch env through a shared list", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" }, worker: { image: "busybox" } }, shareEnv: ["A=one"] });

      expect(() => service.apply(document, { web: { env: { A: "two" } } })).toThrow(/share its env with another part of the document/);
    });

    it("leaves the shared list untouched when it refuses", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" }, worker: { image: "busybox" } }, shareEnv: ["A=one"] });

      expect(() => service.apply(document, { web: { env: { A: "two" } } })).toThrow();
      expect(document.services.worker.env).toEqual(["A=one"]);
    });

    it("allows a patch carrying an empty env record, which would not write to the shared list at all", () => {
      const { service, document } = setup({ services: { web: { image: "nginx" }, worker: { image: "busybox" } }, shareEnv: ["A=one"] });

      service.apply(document, { web: { image: "nginx:1.27", env: {} } });

      expect(document.services.web.image).toBe("nginx:1.27");
    });

    it("refuses to patch credentials through a shared block", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx" }, worker: { image: "busybox" } },
        shareCredentials: { host: "r.test", username: "u", password: "p" }
      });

      expect(() => service.apply(document, { web: { credentials: { host: "r.test", username: "u", password: "rotated" } } })).toThrow(
        /share its credentials with another part of the document/
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

    it("refuses to patch expose through a shared endpoint", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx" }, worker: { image: "busybox" } },
        shareExpose: [{ port: 80, accept: ["a.test"] }]
      });

      expect(() => service.apply(document, { web: { expose: { "80": { accept: ["b.test"] } } } })).toThrow(/share its expose on port 80/);
    });

    it("refuses to patch http options through a shared options block", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx" }, worker: { image: "busybox" } },
        shareHttpOptions: { max_body_size: 1024 }
      });

      expect(() => service.apply(document, { web: { expose: { "80": { httpOptions: { readTimeout: 9000 } } } } })).toThrow(/share its http options on port 80/);
    });

    it("leaves the shared options block untouched when it refuses", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx" }, worker: { image: "busybox" } },
        shareHttpOptions: { max_body_size: 1024 }
      });

      expect(() => service.apply(document, { web: { expose: { "80": { httpOptions: { readTimeout: 9000 } } } } })).toThrow();
      expect(document.services.worker.expose?.[0].http_options).toEqual({ max_body_size: 1024 });
    });

    it("refuses to patch storage through a shared volume", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx" }, worker: { image: "busybox" } },
        shareStorage: { data: { mount: "/data" } }
      });

      expect(() => service.apply(document, { web: { storage: { data: { mount: "/srv" } } } })).toThrow(/share its storage volume data/);
    });

    it("accepts an expose sub-patch that assigns nothing, rather than refusing a write it would never make", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx" }, worker: { image: "busybox" } },
        shareExpose: [{ port: 80, accept: ["a.test"] }]
      });

      service.apply(document, { web: { expose: { "80": {} } } });

      expect(document.services.worker.expose?.[0].accept).toEqual(["a.test"]);
    });

    it("accepts an http options sub-patch that assigns nothing on a shared options block", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx" }, worker: { image: "busybox" } },
        shareHttpOptions: { max_body_size: 1024 }
      });

      service.apply(document, { web: { expose: { "80": { httpOptions: {} } } } });

      expect(document.services.worker.expose?.[0].http_options).toEqual({ max_body_size: 1024 });
    });

    it("accepts a storage sub-patch that assigns nothing, rather than refusing a write it would never make", () => {
      const { service, document } = setup({
        services: { web: { image: "nginx" }, worker: { image: "busybox" } },
        shareStorage: { data: { mount: "/data" } }
      });

      service.apply(document, { web: { storage: { data: {} } } });

      expect(document.services.worker.params?.storage?.data).toEqual({ mount: "/data" });
    });
  });

  function setup(input: {
    services: Record<string, SDLInput["services"][string]>;
    shareEnv?: string[];
    shareCredentials?: NonNullable<SDLInput["services"][string]["credentials"]>;
    shareExpose?: NonNullable<SDLInput["services"][string]["expose"]>;
    shareStorage?: NonNullable<NonNullable<SDLInput["services"][string]["params"]>["storage"]>;
    shareHttpOptions?: NonNullable<NonNullable<SDLInput["services"][string]["expose"]>[number]["http_options"]>;
    aliasWebAs?: string;
  }) {
    const services = { ...input.services };

    for (const name of Object.keys(services)) {
      if (input.shareEnv) services[name] = { ...services[name], env: input.shareEnv };
      if (input.shareCredentials) services[name] = { ...services[name], credentials: input.shareCredentials };
      if (input.shareExpose) services[name] = { ...services[name], expose: input.shareExpose };
      if (input.shareStorage) services[name] = { ...services[name], params: { storage: input.shareStorage } };
      if (input.shareHttpOptions) services[name] = { ...services[name], expose: [{ port: 80, http_options: input.shareHttpOptions }] };
    }

    if (input.aliasWebAs) services[input.aliasWebAs] = services.web;

    const document: SDLInput = {
      version: "2.0",
      services,
      profiles: { compute: {}, placement: {} },
      deployment: {}
    };

    return { service: new SdlPatchService(), document };
  }
});
