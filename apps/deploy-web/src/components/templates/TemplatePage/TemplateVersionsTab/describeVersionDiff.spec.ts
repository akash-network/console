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

  it("returns nothing for an unreadable SDL", () => {
    const readable = sdlOf({ web: { image: "nginx:1.27" } });

    expect(describeVersionDiff(readable, "services: [unclosed")).toEqual([]);
    expect(describeVersionDiff("services: [unclosed", readable)).toEqual([]);
    expect(describeVersionDiff(undefined, "just a string")).toEqual([]);
    expect(describeVersionDiff(undefined, "")).toEqual([]);
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

  it("does not execute YAML tags", () => {
    const hostile = 'services:\n  web:\n    image: !!js/function "function(){ throw new Error(1) }"\n';

    expect(describeVersionDiff(undefined, hostile)).toEqual([]);
  });
});
