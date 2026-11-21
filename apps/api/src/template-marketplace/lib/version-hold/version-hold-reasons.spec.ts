import { describe, expect, it } from "vitest";

import { findRiskyVersionChanges, OFFICIAL_TEMPLATE_HOLD_REASON, TEMPLATE_VERSION_HOLD_KINDS } from "./version-hold-reasons";

type ServiceInput = { image?: unknown; expose?: unknown };

describe(findRiskyVersionChanges.name, () => {
  describe("image repositories", () => {
    it.each([
      { name: "only the tag moves", current: "nginx:1.27", next: "nginx:1.28" },
      { name: "a tag gives way to a digest", current: "nginx:1.27", next: `nginx@sha256:${"a".repeat(64)}` },
      { name: "Docker Hub is spelled out", current: "nginx:1.27", next: "docker.io/library/nginx:1.27" },
      { name: "another Docker Hub alias is used", current: "index.docker.io/acme/web:1", next: "registry-1.docker.io/acme/web:2" },
      { name: "only the case differs", current: "ghcr.io/acme/web:1", next: "GHCR.io/Acme/Web:1" },
      { name: "nothing changes", current: "ghcr.io/acme/web:1", next: "ghcr.io/acme/web:1" }
    ])("finds nothing when $name", ({ current, next }) => {
      expect(findRiskyVersionChanges(sdlOf({ web: { image: current } }), sdlOf({ web: { image: next } }))).toEqual([]);
    });

    it("names the service, both images and the reason when a service moves to another repository", () => {
      const changes = findRiskyVersionChanges(sdlOf({ web: { image: "acme/web:1" } }), sdlOf({ web: { image: "acme/miner:1" } }));

      expect(changes).toEqual([
        {
          kind: "image_repository_changed",
          message: 'Service "web" moves from acme/web:1 to acme/miner:1, an image repository the current version does not run.',
          service: "web",
          image: "acme/miner:1",
          previousImage: "acme/web:1"
        }
      ]);
    });

    it.each([
      { name: "another registry host serves the same path", current: "acme/web:1", next: "ghcr.io/acme/web:1" },
      { name: "a registry gains a port", current: "registry.example.com/acme/web:1", next: "registry.example.com:5000/acme/web:1" },
      { name: "an official image gives way to a namesake of another publisher", current: "nginx:1.27", next: "acme/nginx:1.27" },
      { name: "the path gains a segment", current: "ghcr.io/acme/web:1", next: "ghcr.io/acme/web/extra:1" }
    ])("holds a version when $name", ({ current, next }) => {
      const changes = findRiskyVersionChanges(sdlOf({ web: { image: current } }), sdlOf({ web: { image: next } }));

      expect(changes).toMatchObject([{ kind: "image_repository_changed", service: "web", image: next, previousImage: current }]);
    });

    it("names a new service that runs a repository the current version does not, without a previous image", () => {
      const changes = findRiskyVersionChanges(
        sdlOf({ web: { image: "acme/web:1" } }),
        sdlOf({ web: { image: "acme/web:1" }, worker: { image: "acme/worker:1" } })
      );

      expect(changes).toEqual([
        {
          kind: "image_repository_changed",
          message: 'Service "worker" runs acme/worker:1, an image repository the current version does not run.',
          service: "worker",
          image: "acme/worker:1"
        }
      ]);
    });

    it("finds nothing when a new service runs a repository the current version already runs", () => {
      const next = sdlOf({ web: { image: "acme/web:1" }, replica: { image: "acme/web:2" } });

      expect(findRiskyVersionChanges(sdlOf({ web: { image: "acme/web:1" } }), next)).toEqual([]);
    });

    it("finds nothing when a service is removed", () => {
      const current = sdlOf({ web: { image: "acme/web:1" }, worker: { image: "acme/worker:1" } });

      expect(findRiskyVersionChanges(current, sdlOf({ web: { image: "acme/web:1" } }))).toEqual([]);
    });

    it("finds nothing when images move between services or a service is renamed", () => {
      const current = sdlOf({ web: { image: "acme/web:1" }, worker: { image: "acme/worker:1" } });
      const next = sdlOf({ web: { image: "acme/worker:2" }, tasks: { image: "acme/web:1" } });

      expect(findRiskyVersionChanges(current, next)).toEqual([]);
    });

    it("names every service that runs a new repository", () => {
      const current = sdlOf({ web: { image: "acme/web:1" }, worker: { image: "acme/worker:1" } });
      const next = sdlOf({ web: { image: "other/web:1" }, worker: { image: "other/worker:1" } });

      expect(findRiskyVersionChanges(current, next).map(change => [change.service, change.previousImage])).toEqual([
        ["web", "acme/web:1"],
        ["worker", "acme/worker:1"]
      ]);
    });

    it("reads an image around its white space and skips a service without one", () => {
      const current = sdlOf({ web: { image: "  acme/web:1  " }, sidecar: {}, blank: { image: "   " }, odd: { image: 42 } });
      const next = sdlOf({ web: { image: "acme/web:2" }, sidecar: {}, blank: { image: "" }, odd: { image: ["acme/odd"] } });

      expect(findRiskyVersionChanges(current, next)).toEqual([]);
    });

    it("treats every image as new when the current SDL cannot be read", () => {
      const changes = findRiskyVersionChanges("services: [", sdlOf({ web: { image: "acme/web:1" } }));

      expect(changes).toMatchObject([{ kind: "image_repository_changed", service: "web", image: "acme/web:1" }]);
      expect(changes[0]).not.toHaveProperty("previousImage");
    });

    it.each(["services: [", "- just\n- a list", "services:\n  - web", "", "42"])("finds nothing in a next SDL that holds no services: %j", next => {
      expect(findRiskyVersionChanges(sdlOf({ web: { image: "acme/web:1" } }), next)).toEqual([]);
    });
  });

  describe("global ports", () => {
    const IMAGE = "acme/web:1";

    it("names the service, port and protocol of a port a service newly opens to the internet", () => {
      const current = sdlOf({ web: { image: IMAGE, expose: [{ port: 80, to: [{ global: true }] }] } });
      const next = sdlOf({
        web: {
          image: IMAGE,
          expose: [
            { port: 80, to: [{ global: true }] },
            { port: 22, to: [{ global: true }] }
          ]
        }
      });

      expect(findRiskyVersionChanges(current, next)).toEqual([
        {
          kind: "global_port_added",
          message: 'Service "web" opens port 22 (tcp) to the internet, which the current version does not.',
          service: "web",
          port: 22,
          protocol: "tcp"
        }
      ]);
    });

    it("holds a port that was open to another service only and is now global", () => {
      const current = sdlOf({ db: { image: IMAGE, expose: [{ port: 5432, to: [{ service: "web" }] }] } });
      const next = sdlOf({ db: { image: IMAGE, expose: [{ port: 5432, to: [{ service: "web" }, { global: true }] }] } });

      expect(findRiskyVersionChanges(current, next)).toMatchObject([{ kind: "global_port_added", service: "db", port: 5432, protocol: "tcp" }]);
    });

    it.each([
      { name: "the target sits among other targets", to: [{ service: "web" }, { global: true }] },
      { name: "the target also asks for a leased IP", to: [{ global: true, ip: "main" }] },
      { name: "the port is a numeric string", to: [{ global: true }], port: "8080" }
    ])("holds a new global port when $name", ({ to, port = 8080 }) => {
      const next = sdlOf({ web: { image: IMAGE, expose: [{ port, to }] } });

      expect(findRiskyVersionChanges(sdlOf({ web: { image: IMAGE } }), next)).toMatchObject([{ kind: "global_port_added", service: "web", port: 8080 }]);
    });

    it.each([
      { name: "the port is open to a service only", expose: [{ port: 8080, to: [{ service: "web" }] }] },
      { name: "global is false", expose: [{ port: 8080, to: [{ global: false }] }] },
      { name: "global is the word true rather than the boolean", expose: [{ port: 8080, to: [{ global: "true" }] }] },
      { name: "the port names no target", expose: [{ port: 8080 }] },
      { name: "the targets are not a list", expose: [{ port: 8080, to: { global: true } }] },
      { name: "a target is not a mapping", expose: [{ port: 8080, to: ["global"] }] },
      { name: "the port is not a whole number", expose: [{ port: "http", to: [{ global: true }] }] },
      { name: "the exposed entry is not a mapping", expose: ["8080"] },
      { name: "expose is not a list", expose: { port: 8080, to: [{ global: true }] } }
    ])("finds nothing when $name", ({ expose }) => {
      expect(findRiskyVersionChanges(sdlOf({ web: { image: IMAGE } }), sdlOf({ web: { image: IMAGE, expose } }))).toEqual([]);
    });

    it.each([
      { name: "the external port number changes", next: { port: 80, as: 8080, to: [{ global: true }] } },
      { name: "the accepted hostnames change", next: { port: 80, accept: ["example.com", "www.example.com"], to: [{ global: true }] } },
      { name: "the protocol is written in another case", next: { port: 80, proto: "TCP", to: [{ global: true }] } },
      { name: "the default protocol is spelled out", next: { port: 80, proto: "tcp", to: [{ global: true }] } },
      { name: "a second target is added", next: { port: 80, to: [{ global: true }, { service: "db" }] } }
    ])("finds nothing new in a port that was already global when $name", ({ next }) => {
      const current = sdlOf({ web: { image: IMAGE, expose: [{ port: 80, as: 80, accept: ["example.com"], to: [{ global: true }] }] } });

      expect(findRiskyVersionChanges(current, sdlOf({ web: { image: IMAGE, expose: [next] } }))).toEqual([]);
    });

    it("holds the same port number opened over another protocol", () => {
      const current = sdlOf({ web: { image: IMAGE, expose: [{ port: 53, to: [{ global: true }] }] } });
      const next = sdlOf({ web: { image: IMAGE, expose: [{ port: 53, proto: "UDP", to: [{ global: true }] }] } });

      expect(findRiskyVersionChanges(current, next)).toMatchObject([{ kind: "global_port_added", port: 53, protocol: "udp" }]);
    });

    it("holds another container port served under an external number that was already global", () => {
      const current = sdlOf({ web: { image: IMAGE, expose: [{ port: 3000, as: 80, to: [{ global: true }] }] } });
      const next = sdlOf({ web: { image: IMAGE, expose: [{ port: 22, as: 80, to: [{ global: true }] }] } });

      expect(findRiskyVersionChanges(current, next)).toMatchObject([{ kind: "global_port_added", port: 22 }]);
    });

    it("holds a global port that moves to another service", () => {
      const current = sdlOf({ web: { image: IMAGE, expose: [{ port: 80, to: [{ global: true }] }] }, db: { image: IMAGE } });
      const next = sdlOf({ web: { image: IMAGE }, db: { image: IMAGE, expose: [{ port: 80, to: [{ global: true }] }] } });

      expect(findRiskyVersionChanges(current, next)).toMatchObject([{ kind: "global_port_added", service: "db", port: 80 }]);
    });

    it("names a port once however often the service lists it", () => {
      const next = sdlOf({
        web: {
          image: IMAGE,
          expose: [
            { port: 80, as: 80, to: [{ global: true }] },
            { port: 80, as: 8080, to: [{ global: true }] }
          ]
        }
      });

      expect(findRiskyVersionChanges(sdlOf({ web: { image: IMAGE } }), next)).toHaveLength(1);
    });

    it("finds nothing when a global port is closed", () => {
      const current = sdlOf({ web: { image: IMAGE, expose: [{ port: 80, to: [{ global: true }] }] } });

      expect(findRiskyVersionChanges(current, sdlOf({ web: { image: IMAGE } }))).toEqual([]);
    });
  });

  it("lists image changes before port changes", () => {
    const current = sdlOf({ web: { image: "acme/web:1" } });
    const next = sdlOf({ web: { image: "other/web:1", expose: [{ port: 80, to: [{ global: true }] }] } });

    expect(findRiskyVersionChanges(current, next).map(change => change.kind)).toEqual(["image_repository_changed", "global_port_added"]);
  });

  function sdlOf(services: Record<string, ServiceInput>) {
    return JSON.stringify({ version: "2.0", services });
  }
});

describe("hold reason kinds", () => {
  it("lists the reason an Official template is held for among the kinds a version can be held for", () => {
    expect(TEMPLATE_VERSION_HOLD_KINDS).toEqual(["official_template", "image_repository_changed", "global_port_added"]);
    expect(OFFICIAL_TEMPLATE_HOLD_REASON).toEqual({
      kind: "official_template",
      message: "This is an Official template, so Akash staff review every new version before it goes live."
    });
  });
});
