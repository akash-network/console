import { describe, expect, it } from "vitest";

import type { AssistantActionOf } from "@src/types/assistant";
import { updateDeploymentDiff } from "./updateDeploymentDiff";

type ServiceUpdate = AssistantActionOf<"update_deployment">["services"][number];

describe(updateDeploymentDiff.name, () => {
  it("shows an image bump and a changed variable without its current value", () => {
    const diff = updateDeploymentDiff([
      serviceUpdate({ patch: { image: "ghcr.io/acme/api:1.4.2", env: { LOG_LEVEL: "debug" } }, before: { envKeys: ["MODEL_ID", "LOG_LEVEL", "HF_TOKEN"] } })
    ]);

    expect(diff).toEqual({
      removed: ["image: ghcr.io/acme/api:1.4.1", "LOG_LEVEL (current value)"],
      added: ["image: ghcr.io/acme/api:1.4.2", "LOG_LEVEL=debug"],
      unchanged: "MODEL_ID, HF_TOKEN unchanged",
      newDomains: [],
      restartsContainer: true
    });
  });

  it("shows a removed variable as a removal only and a new one as an addition only", () => {
    const diff = updateDeploymentDiff([serviceUpdate({ patch: { env: { DEBUG: null, NEW_FLAG: "1" } }, before: { envKeys: ["DEBUG"] } })]);

    expect(diff.removed).toEqual(["DEBUG"]);
    expect(diff.added).toEqual(["NEW_FLAG=1"]);
    expect(diff.unchanged).toBeUndefined();
  });

  it("ignores removing a variable the service never declared", () => {
    const diff = updateDeploymentDiff([serviceUpdate({ patch: { env: { MISSING: null } } })]);

    expect(diff.removed).toEqual([]);
    expect(diff.added).toEqual([]);
  });

  it("lists command and args, with the image default for an empty value", () => {
    const diff = updateDeploymentDiff([serviceUpdate({ patch: { command: ["sh", "-c"], args: null }, before: { command: null, args: ["--port", "80"] } })]);

    expect(diff.removed).toEqual(["command: image default", 'args: ["--port","80"]']);
    expect(diff.added).toEqual(['command: ["sh","-c"]', "args: image default"]);
    expect(diff.restartsContainer).toBe(true);
  });

  it("shows an image the service never had as none", () => {
    const diff = updateDeploymentDiff([serviceUpdate({ patch: { image: "nginx" }, before: { image: null } })]);

    expect(diff.removed).toEqual(["image: none"]);
  });

  it("shows port, exposed port, domains and http options, and lists the new domains", () => {
    const diff = updateDeploymentDiff([
      serviceUpdate({
        patch: {
          expose: { "8000": { as: 8080, accept: ["old.example.com", "new.example.com"], httpOptions: { readTimeout: 60000, nextCases: ["error", "timeout"] } } }
        },
        before: { expose: [{ port: 8000, as: 80, accept: ["old.example.com"], global: true }] }
      })
    ]);

    expect(diff.removed).toEqual(["port 8000 exposed as 80", "port 8000 domains: old.example.com"]);
    expect(diff.added).toEqual([
      "port 8000 exposed as 8080",
      "port 8000 domains: old.example.com, new.example.com",
      "port 8000 readTimeout: 60000",
      "port 8000 nextCases: error, timeout"
    ]);
    expect(diff.newDomains).toEqual(["new.example.com"]);
    expect(diff.restartsContainer).toBe(false);
  });

  it("restarts the container when the container port moves, and defaults an unknown endpoint", () => {
    const diff = updateDeploymentDiff([serviceUpdate({ patch: { expose: { "3000": { port: 3001, as: 81, accept: [] } } } })]);

    expect(diff.removed).toEqual(["port 3000", "port 3000 exposed as 3000", "port 3000 domains: none"]);
    expect(diff.added).toEqual(["port 3001", "port 3000 exposed as 81", "port 3000 domains: none"]);
    expect(diff.newDomains).toEqual([]);
    expect(diff.restartsContainer).toBe(true);
  });

  it("shows storage mount and read-only changes", () => {
    const diff = updateDeploymentDiff([
      serviceUpdate({
        patch: { storage: { data: { mount: "/models", readOnly: true } } },
        before: { storage: [{ volume: "data", mount: "/data", readOnly: false }] }
      })
    ]);

    expect(diff.removed).toEqual(["data mount: /data", "data read-only: false"]);
    expect(diff.added).toEqual(["data mount: /models", "data read-only: true"]);
    expect(diff.restartsContainer).toBe(true);
  });

  it("shows an unknown volume as having no mount", () => {
    const diff = updateDeploymentDiff([serviceUpdate({ patch: { storage: { cache: { mount: "/cache" } } } })]);

    expect(diff.removed).toEqual(["cache mount: none"]);
  });

  it("does not restart the container for empty env, storage and expose records", () => {
    const diff = updateDeploymentDiff([serviceUpdate({ patch: { env: {}, storage: {}, expose: { "80": { accept: ["a.example.com"] } } } })]);

    expect(diff.restartsContainer).toBe(false);
  });

  it("prefixes every line with its service when several change", () => {
    const diff = updateDeploymentDiff([
      serviceUpdate({ service: "web", patch: { image: "web:2" }, before: { image: "web:1", envKeys: ["A"] } }),
      serviceUpdate({ service: "worker", patch: { image: "worker:2" }, before: { image: "worker:1", envKeys: ["B"] } })
    ]);

    expect(diff.removed).toEqual(["web: image: web:1", "worker: image: worker:1"]);
    expect(diff.added).toEqual(["web: image: web:2", "worker: image: worker:2"]);
    expect(diff.unchanged).toBe("web: A unchanged; worker: B unchanged");
  });

  function serviceUpdate(input: { service?: string; patch: ServiceUpdate["patch"]; before?: Partial<ServiceUpdate["before"]> }): ServiceUpdate {
    return {
      service: input.service ?? "web",
      patch: input.patch,
      before: { image: "ghcr.io/acme/api:1.4.1", command: null, args: null, envKeys: [], expose: [], storage: [], ...input.before }
    };
  }
});
