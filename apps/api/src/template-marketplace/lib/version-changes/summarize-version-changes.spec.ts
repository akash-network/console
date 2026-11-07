import { describe, expect, it } from "vitest";

import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import { summarizeVersionChanges, TEMPLATE_VERSION_CHANGES, type TemplateVersionChange } from "./summarize-version-changes";

describe(summarizeVersionChanges.name, () => {
  it("calls a version with no predecessor the first version", () => {
    expect(summarizeVersionChanges(undefined, content({ sdl: sdlOf({}) }))).toEqual(["first_version"]);
  });

  it("reports nothing for an identical version", () => {
    const version = content({ sdl: sdlOf({ web: { image: "nginx:1" } }), readme: "r", askedValues: [textValue("A")] });

    expect(summarizeVersionChanges(version, { ...version })).toEqual([]);
  });

  it.each<[string, Parameters<typeof content>[0], Parameters<typeof content>[0], TemplateVersionChange[]]>([
    [
      "a service is added",
      { sdl: sdlOf({ web: { image: "nginx:1" } }) },
      { sdl: sdlOf({ web: { image: "nginx:1" }, db: { image: "pg:1" } }) },
      ["service_added"]
    ],
    [
      "a service is removed",
      { sdl: sdlOf({ web: { image: "nginx:1" }, db: { image: "pg:1" } }) },
      { sdl: sdlOf({ web: { image: "nginx:1" } }) },
      ["service_removed"]
    ],
    [
      "a service is replaced",
      { sdl: sdlOf({ web: { image: "nginx:1" } }) },
      { sdl: sdlOf({ api: { image: "nginx:1" } }) },
      ["service_added", "service_removed"]
    ],
    ["the image repository changes", { sdl: sdlOf({ web: { image: "nginx:1" } }) }, { sdl: sdlOf({ web: { image: "caddy:1" } }) }, ["image_changed"]],
    [
      "the image repository and tag both change",
      { sdl: sdlOf({ web: { image: "nginx:1" } }) },
      { sdl: sdlOf({ web: { image: "caddy:2" } }) },
      ["image_changed"]
    ],
    ["only the image tag changes", { sdl: sdlOf({ web: { image: "nginx:1" } }) }, { sdl: sdlOf({ web: { image: "nginx:2" } }) }, ["image_tag_changed"]],
    ["an image gains a tag", { sdl: sdlOf({ web: { image: "nginx" } }) }, { sdl: sdlOf({ web: { image: "nginx:2" } }) }, ["image_tag_changed"]],
    [
      "an env var is added",
      { sdl: sdlOf({ web: { image: "a:1", env: ["A=1"] } }) },
      { sdl: sdlOf({ web: { image: "a:1", env: ["A=1", "B=2"] } }) },
      ["env_changed"]
    ],
    ["an env value changes", { sdl: sdlOf({ web: { image: "a:1", env: ["A=1"] } }) }, { sdl: sdlOf({ web: { image: "a:1", env: ["A=2"] } }) }, ["env_changed"]],
    ["env appears", { sdl: sdlOf({ web: { image: "a:1" } }) }, { sdl: sdlOf({ web: { image: "a:1", env: ["A=1"] } }) }, ["env_changed"]],
    [
      "an exposed port changes",
      { sdl: sdlOf({ web: { image: "a:1", expose: [{ port: 80, as: 80 }] } }) },
      { sdl: sdlOf({ web: { image: "a:1", expose: [{ port: 8080, as: 80 }] } }) },
      ["ports_changed"]
    ],
    [
      "the compute profiles change",
      { sdl: sdlOf({ web: { image: "a:1" } }, { web: { resources: { cpu: { units: 1 } } } }) },
      { sdl: sdlOf({ web: { image: "a:1" } }, { web: { resources: { cpu: { units: 2 } } } }) },
      ["resources_changed"]
    ],
    ["a value is asked", { sdl: sdlOf({}), askedValues: [] }, { sdl: sdlOf({}), askedValues: [textValue("A")] }, ["asked_value_added"]],
    ["a value is no longer asked", { sdl: sdlOf({}), askedValues: [textValue("A")] }, { sdl: sdlOf({}), askedValues: [] }, ["asked_value_removed"]],
    [
      "an asked value is edited",
      { sdl: sdlOf({}), askedValues: [textValue("A", { label: "Old" })] },
      { sdl: sdlOf({}), askedValues: [textValue("A", { label: "New" })] },
      ["asked_value_changed"]
    ],
    [
      "an asked value is swapped for another key",
      { sdl: sdlOf({}), askedValues: [textValue("A")] },
      { sdl: sdlOf({}), askedValues: [textValue("B")] },
      ["asked_value_added", "asked_value_removed"]
    ],
    ["the readme is edited", { sdl: sdlOf({}), readme: "a" }, { sdl: sdlOf({}), readme: "b" }, ["readme_changed"]],
    ["the readme is cleared", { sdl: sdlOf({}), readme: "a" }, { sdl: sdlOf({}), readme: null }, ["readme_changed"]]
  ])("reports %s", (_name, previous, next, expected) => {
    expect(summarizeVersionChanges(content(previous), content(next))).toEqual(expected);
  });

  it("tells a new tag from a new repository on a registry with a port", () => {
    const previous = content({ sdl: sdlOf({ web: { image: "registry:5000/app:1" } }) });

    expect(summarizeVersionChanges(previous, content({ sdl: sdlOf({ web: { image: "registry:5000/app:2" } }) }))).toEqual(["image_tag_changed"]);
    expect(summarizeVersionChanges(previous, content({ sdl: sdlOf({ web: { image: "registry:5001/app:1" } }) }))).toEqual(["image_changed"]);
  });

  it("does not take the port of an untagged image on a registry for a tag", () => {
    const previous = content({ sdl: sdlOf({ web: { image: "registry:5000/app" } }) });

    expect(summarizeVersionChanges(previous, content({ sdl: sdlOf({ web: { image: "registry:5000/app:2" } }) }))).toEqual(["image_tag_changed"]);
  });

  it("ignores the order of env entries", () => {
    const previous = content({ sdl: sdlOf({ web: { image: "a:1", env: ["A=1", "B=2"] } }) });
    const next = content({ sdl: sdlOf({ web: { image: "a:1", env: ["B=2", "A=1"] } }) });

    expect(summarizeVersionChanges(previous, next)).toEqual([]);
  });

  it("compares the env, image and ports of shared services only", () => {
    const previous = content({ sdl: sdlOf({ web: { image: "a:1", env: ["A=1"] } }) });
    const next = content({ sdl: sdlOf({ api: { image: "b:2", env: ["B=1"], expose: [{ port: 1 }] } }) });

    expect(summarizeVersionChanges(previous, next)).toEqual(["service_added", "service_removed"]);
  });

  it("lists every change once, in the order of the catalogue", () => {
    const previous = content({ sdl: sdlOf({ web: { image: "a:1" } }), readme: "a", askedValues: [textValue("A")] });
    const next = content({ sdl: sdlOf({ web: { image: "b:1" }, db: { image: "pg:1" } }), readme: "b", askedValues: [] });

    const changes = summarizeVersionChanges(previous, next);

    expect(changes).toEqual(["service_added", "image_changed", "asked_value_removed", "readme_changed"]);
    expect(changes).toEqual(TEMPLATE_VERSION_CHANGES.filter(change => changes.includes(change)));
  });

  it("reports no SDL change when either SDL cannot be read", () => {
    const readable = content({ sdl: sdlOf({ web: { image: "a:1" } }), readme: "a" });
    const unreadable = content({ sdl: "services: [unclosed", readme: "b" });

    expect(summarizeVersionChanges(readable, unreadable)).toEqual(["readme_changed"]);
    expect(summarizeVersionChanges(unreadable, readable)).toEqual(["readme_changed"]);
  });

  it("reports no SDL change when an SDL is not a mapping", () => {
    const readable = content({ sdl: sdlOf({ web: { image: "a:1" } }) });

    expect(summarizeVersionChanges(readable, content({ sdl: "- a\n- b" }))).toEqual([]);
    expect(summarizeVersionChanges(content({ sdl: "just text" }), readable)).toEqual([]);
  });

  it("treats an SDL without services as one with none", () => {
    const readable = content({ sdl: sdlOf({ web: { image: "a:1" } }) });

    expect(summarizeVersionChanges(readable, content({ sdl: "version: '2.0'" }))).toEqual(["service_removed"]);
  });

  it("tolerates services that are not mappings", () => {
    const previous = content({ sdl: "services:\n  web: nope" });

    expect(summarizeVersionChanges(previous, content({ sdl: "services:\n  web: other" }))).toEqual([]);
    expect(summarizeVersionChanges(previous, content({ sdl: sdlOf({ web: { image: "a:1" } }) }))).toEqual([]);
  });

  it("treats an env that is not a list as empty", () => {
    const previous = content({ sdl: "services:\n  web:\n    image: a:1\n    env: nope" });

    expect(summarizeVersionChanges(previous, content({ sdl: sdlOf({ web: { image: "a:1", env: ["A=1"] } }) }))).toEqual(["env_changed"]);
    expect(summarizeVersionChanges(previous, content({ sdl: sdlOf({ web: { image: "a:1", env: [] } }) }))).toEqual([]);
  });

  function content(input: { sdl: string; readme?: string | null; askedValues?: AskedValue[] }) {
    return { sdl: input.sdl, readme: input.readme ?? null, askedValues: input.askedValues ?? [] };
  }

  function sdlOf(services: Record<string, object>, compute?: Record<string, object>) {
    return JSON.stringify({ version: "2.0", services, ...(compute && { profiles: { compute } }) });
  }

  function textValue(key: string, overrides: Partial<Extract<AskedValue, { type: "text" }>> = {}): AskedValue {
    return { type: "text", key, label: key, required: true, bindings: [{ service: "web", env: key }], ...overrides };
  }
});
