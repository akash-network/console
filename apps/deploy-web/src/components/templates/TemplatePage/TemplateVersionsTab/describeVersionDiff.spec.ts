import { describe, expect, it } from "vitest";

import { describeVersionDiff } from "./describeVersionDiff";

const sdlOf = (services: Record<string, { image: string; env?: string[] }>) =>
  `version: "2.0"\nservices:\n${Object.entries(services)
    .map(([name, { image, env }]) => `  ${name}:\n    image: ${image}\n${env ? `    env:\n${env.map(line => `      - ${line}`).join("\n")}\n` : ""}`)
    .join("")}`;

describe(describeVersionDiff.name, () => {
  it("lists the image and env lines each service changed", () => {
    const previous = sdlOf({
      web: { image: "nginx:1.26", env: ["MODE=dev", "KEEP=1"] },
      db: { image: "postgres:16", env: ["POSTGRES_DB=app"] }
    });
    const next = sdlOf({
      web: { image: "nginx:1.27", env: ["MODE=prod", "KEEP=1", "DEBUG=0"] },
      db: { image: "postgres:16", env: ["POSTGRES_DB=app"] }
    });

    expect(describeVersionDiff(previous, next)).toEqual([
      { service: "web", field: "image", removed: ["nginx:1.26"], added: ["nginx:1.27"] },
      { service: "web", field: "env", removed: ["MODE=dev"], added: ["MODE=prod", "DEBUG=0"] }
    ]);
  });

  it("returns null for an unreadable SDL, so it never reads as no change", () => {
    const readable = sdlOf({ web: { image: "nginx:1.27" } });

    expect(describeVersionDiff(readable, "services: [unclosed")).toBeNull();
    expect(describeVersionDiff("services: [unclosed", readable)).toBeNull();
    expect(describeVersionDiff(undefined, "just a string")).toBeNull();
    expect(describeVersionDiff(undefined, "")).toBeNull();
  });

  it("returns nothing when no image or env line changed", () => {
    const sdl = sdlOf({ web: { image: "nginx:1.27", env: ["MODE=prod"] } });

    expect(describeVersionDiff(sdl, sdl)).toEqual([]);
  });

  it("lists every line of a service the version added and removed", () => {
    const previous = sdlOf({ old: { image: "redis:7", env: ["A=1"] } });
    const next = sdlOf({ fresh: { image: "nginx:1.27", env: ["B=2"] } });

    expect(describeVersionDiff(previous, next)).toEqual([
      { service: "fresh", field: "image", removed: [], added: ["nginx:1.27"] },
      { service: "fresh", field: "env", removed: [], added: ["B=2"] },
      { service: "old", field: "image", removed: ["redis:7"], added: [] },
      { service: "old", field: "env", removed: ["A=1"], added: [] }
    ]);
  });

  it("lists every line as added when there is no previous version", () => {
    expect(describeVersionDiff(undefined, sdlOf({ web: { image: "nginx:1.27", env: ["MODE=prod"] } }))).toEqual([
      { service: "web", field: "image", removed: [], added: ["nginx:1.27"] },
      { service: "web", field: "env", removed: [], added: ["MODE=prod"] }
    ]);
  });

  it("refuses the function tag that only an unsafe load would resolve", () => {
    const hostile = 'services:\n  web:\n    image: nginx:1.27\n  evil:\n    image: !!js/function "function(){ return 1 }"\n';

    expect(describeVersionDiff(undefined, hostile)).toBeNull();
  });

  it("returns null when services is not a mapping", () => {
    expect(describeVersionDiff(undefined, "services: nginx")).toBeNull();
    expect(describeVersionDiff(undefined, "services:\n  - web")).toBeNull();
    expect(describeVersionDiff(undefined, "services:")).toBeNull();
  });

  it("treats a service that is a scalar or null as having no lines", () => {
    const previous = sdlOf({ web: { image: "nginx:1.26" } });

    expect(describeVersionDiff(undefined, "services:\n  web: nginx\n  db:\n")).toEqual([]);
    expect(describeVersionDiff(previous, "services:\n  web:\n")).toEqual([{ service: "web", field: "image", removed: ["nginx:1.26"], added: [] }]);
  });

  it("ignores an env that is a map or a string and an image that is not text", () => {
    expect(describeVersionDiff(undefined, "services:\n  web:\n    image: [a, b]\n    env:\n      MODE: prod\n")).toEqual([]);
    expect(describeVersionDiff(undefined, "services:\n  web:\n    image: 12\n    env: MODE=prod\n")).toEqual([]);
  });

  it("keeps only the env entries that are text", () => {
    const sdl = "services:\n  web:\n    image: nginx:1.27\n    env:\n      - MODE=prod\n      - 1\n      - null\n      - [A=1]\n      - {B: 2}\n";

    expect(describeVersionDiff(undefined, sdl)).toEqual([
      { service: "web", field: "image", removed: [], added: ["nginx:1.27"] },
      { service: "web", field: "env", removed: [], added: ["MODE=prod"] }
    ]);
  });

  it("lists a repeated env line once", () => {
    const next = sdlOf({ web: { image: "nginx:1.27", env: ["A=1", "A=1", "B=2"] } });

    expect(describeVersionDiff(undefined, next)).toContainEqual({ service: "web", field: "env", removed: [], added: ["A=1", "B=2"] });
  });

  it("answers at once for an alias chain that expands exponentially", () => {
    const levels = Array.from({ length: 40 }, (_, level) => (level === 0 ? "l0: &l0 [a, a]" : `l${level}: &l${level} [*l${level - 1}, *l${level - 1}]`));
    const hostile = `${levels.join("\n")}\nservices:\n  web:\n    image: nginx:1.27\n    env: *l39\n`;

    expect(describeVersionDiff(undefined, hostile)).toEqual([{ service: "web", field: "image", removed: [], added: ["nginx:1.27"] }]);
  });

  it("compares large env lists by content", () => {
    const lines = (from: number, to: number) => Array.from({ length: to - from }, (_, index) => `K${from + index}=v`);
    const previous = sdlOf({ web: { image: "nginx:1.27", env: lines(0, 60000) } });
    const next = sdlOf({ web: { image: "nginx:1.27", env: lines(30000, 90000) } });

    const [entry] = describeVersionDiff(previous, next) ?? [];

    expect(entry.field).toBe("env");
    expect(entry.removed).toHaveLength(30000);
    expect(entry.added).toHaveLength(30000);
    expect(entry.removed[0]).toBe("K0=v");
    expect(entry.added[29999]).toBe("K89999=v");
  });
});
