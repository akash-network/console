import { describe, expect, it } from "vitest";

import { summarizeSdl } from "./sdl-summary";

describe(summarizeSdl.name, () => {
  it("summarizes each service with env names only, its exposure, mounts and the resources of its profile", () => {
    const summary = summarizeSdl({
      services: {
        web: {
          image: "nginx:1.25.3",
          command: ["nginx"],
          args: ["-g", "daemon off;"],
          env: ["PORT=80", "API_TOKEN=hunter2", "FLAG"],
          expose: [
            { port: 80, as: 8080, accept: ["example.com"], to: [{ global: true }] },
            { port: 9000, to: [{ service: "db" }] }
          ],
          params: { storage: { data: { mount: "/data", readOnly: true }, cache: {} } }
        }
      },
      profiles: {
        compute: {
          web: {
            resources: {
              cpu: { units: "0.5" },
              memory: { size: "512Mi" },
              storage: [{ size: "1Gi" }, { name: "data", size: 10 }],
              gpu: { units: 2, attributes: { vendor: { nvidia: [{ model: "a100" }, { model: "h100" }] } } }
            }
          }
        }
      },
      deployment: { web: { dcloud: { profile: "web", count: 3 } } }
    });

    expect(summary).toEqual([
      {
        service: "web",
        image: "nginx:1.25.3",
        command: ["nginx"],
        args: ["-g", "daemon off;"],
        envKeys: ["PORT", "API_TOKEN", "FLAG"],
        expose: [
          { port: 80, as: 8080, accept: ["example.com"], global: true },
          { port: 9000, as: null, accept: [], global: false }
        ],
        storage: [
          { volume: "data", mount: "/data", readOnly: true },
          { volume: "cache", mount: null, readOnly: false }
        ],
        resources: { cpu: 0.5, memory: "512Mi", storage: ["1Gi", "10"], gpu: { units: 2, models: ["nvidia/a100", "nvidia/h100"] }, count: 3 }
      }
    ]);
  });

  it("reports nulls and empty lists for a bare service without a placement", () => {
    expect(summarizeSdl({ services: { worker: {} } })).toEqual([
      {
        service: "worker",
        image: null,
        command: null,
        args: null,
        envKeys: [],
        expose: [],
        storage: [],
        resources: { cpu: null, memory: null, storage: [], gpu: null, count: null }
      }
    ]);
  });

  it("reports a single storage entry, no gpu for zero units and no models for unreadable gpu attributes", () => {
    const resourcesOf = (gpu: unknown) =>
      summarizeSdl({
        services: { app: { image: "app:1" } },
        profiles: { compute: { app: { resources: { cpu: { units: 1 }, memory: { size: "1Gi" }, storage: { size: "2Gi" }, gpu } } } },
        deployment: { app: { akash: { profile: "app", count: 1 } } }
      })?.[0].resources;

    expect(resourcesOf({ units: 0 })).toEqual({ cpu: 1, memory: "1Gi", storage: ["2Gi"], gpu: null, count: 1 });
    expect(resourcesOf({ units: "1", attributes: { vendor: "nvidia" } })?.gpu).toEqual({ units: 1, models: [] });
    expect(resourcesOf({ units: 1, attributes: { vendor: { nvidia: null } } })?.gpu).toEqual({ units: 1, models: [] });
  });

  it("reports no resources when the placement names an unknown profile", () => {
    const [summary] = summarizeSdl({ services: { app: {} }, deployment: { app: { akash: { profile: "missing", count: 2 } } } }) ?? [];

    expect(summary.resources).toEqual({ cpu: null, memory: null, storage: [], gpu: null, count: 2 });
  });

  it("returns null for a document that is not an SDL", () => {
    expect(summarizeSdl({ services: "nope" })).toBeNull();
    expect(summarizeSdl(null)).toBeNull();
  });
});
