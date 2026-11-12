import { describe, expect, it } from "vitest";

import type { AskedValue } from "./asked-values.schema";
import { findSecretValueIssues } from "./find-secret-value-issues";

describe(findSecretValueIssues.name, () => {
  it.each([
    {
      name: "a secret bound to an env that carries a value",
      env: ["TOKEN=hunter2"],
      askedValues: [secretValue("TOKEN")],
      expected: 'Variable "TOKEN" is a secret, so web.env.TOKEN must not carry a value'
    },
    {
      name: "a secret bound to an env holding another kind of reference",
      env: ["TOKEN=ac-other://TOKEN"],
      askedValues: [secretValue("TOKEN")],
      expected: 'Variable "TOKEN" is a secret, so web.env.TOKEN must not carry a value'
    },
    {
      name: "a secret bound to an env holding a lookalike of a reference",
      env: ["TOKEN=ac-secret://not a name"],
      askedValues: [secretValue("TOKEN")],
      expected: 'Variable "TOKEN" is a secret, so web.env.TOKEN must not carry a value'
    },
    {
      name: "a secret reference no secret variable asks for",
      env: ["TOKEN=ac-secret://TOKEN"],
      askedValues: [],
      expected: "web.env.TOKEN references a secret that no variable asks the deployer for"
    },
    {
      name: "a secret reference bound to a variable that is not a secret",
      env: ["TOKEN=ac-secret://TOKEN"],
      askedValues: [textValue("TOKEN")],
      expected: "web.env.TOKEN references a secret that no variable asks the deployer for"
    },
    {
      name: "a secret reference in an env another secret does not bind",
      env: ["TOKEN=ac-secret://TOKEN"],
      askedValues: [secretValue("OTHER")],
      expected: "web.env.TOKEN references a secret that no variable asks the deployer for"
    },
    {
      name: "a plaintext registry password",
      env: [],
      credentials: { host: "ghcr.io", username: "me", password: "hunter2" },
      askedValues: [],
      expected: 'Service "web" carries a registry password; save it as a secret instead'
    },
    {
      name: "an empty registry password",
      env: [],
      credentials: { host: "ghcr.io", username: "me", password: "" },
      askedValues: [],
      expected: 'Service "web" carries a registry password; save it as a secret instead'
    },
    {
      name: "a registry password typed as a number",
      env: [],
      credentials: { host: "ghcr.io", username: "me", password: 12345 },
      askedValues: [],
      expected: 'Service "web" carries a registry password; save it as a secret instead'
    },
    {
      name: "a registry password typed as a boolean",
      env: [],
      credentials: { host: "ghcr.io", username: "me", password: true },
      askedValues: [],
      expected: 'Service "web" carries a registry password; save it as a secret instead'
    },
    {
      name: "a secret bound to an env written as a mapping that carries a value",
      env: { TOKEN: "hunter2" },
      askedValues: [secretValue("TOKEN")],
      expected: 'Variable "TOKEN" is a secret, so web.env.TOKEN must not carry a value'
    },
    {
      name: "a secret bound to an env written as a mapping that carries a number",
      env: { TOKEN: 12345 },
      askedValues: [secretValue("TOKEN")],
      expected: 'Variable "TOKEN" is a secret, so web.env.TOKEN must not carry a value'
    },
    {
      name: "a secret reference in an env written as a mapping that no variable asks for",
      env: { TOKEN: "ac-secret://TOKEN" },
      askedValues: [],
      expected: "web.env.TOKEN references a secret that no variable asks the deployer for"
    }
  ])("refuses $name", ({ env, credentials, askedValues, expected }) => {
    expect(findSecretValueIssues(sdlWith({ web: { env, credentials } }), askedValues)).toEqual([expected]);
  });

  it("accepts a secret bound in two services, each holding a reference", () => {
    const sdl = sdlWith({ web: { env: ["TOKEN=ac-secret://TOKEN"] }, worker: { env: ["API_TOKEN=ac-secret://TOKEN"] } });
    const askedValues = [
      secretValue("TOKEN", [
        { service: "web", env: "TOKEN" },
        { service: "worker", env: "API_TOKEN" }
      ])
    ];

    expect(findSecretValueIssues(sdl, askedValues)).toEqual([]);
  });

  it("names the service and env of each refused binding", () => {
    const sdl = sdlWith({ web: { env: ["TOKEN=one"] }, worker: { env: ["API_TOKEN=two"] } });
    const askedValues = [
      secretValue("TOKEN", [
        { service: "web", env: "TOKEN" },
        { service: "worker", env: "API_TOKEN" }
      ])
    ];

    expect(findSecretValueIssues(sdl, askedValues)).toEqual([
      'Variable "TOKEN" is a secret, so web.env.TOKEN must not carry a value',
      'Variable "TOKEN" is a secret, so worker.env.API_TOKEN must not carry a value'
    ]);
  });

  it("accepts an empty value and a bare key for a secret", () => {
    const sdl = sdlWith({ web: { env: ["TOKEN="] }, worker: { env: ["API_TOKEN"] } });
    const askedValues = [
      secretValue("TOKEN", [
        { service: "web", env: "TOKEN" },
        { service: "worker", env: "API_TOKEN" }
      ])
    ];

    expect(findSecretValueIssues(sdl, askedValues)).toEqual([]);
  });

  it("accepts an env written as a mapping whose secret is empty or a reference, and a missing password", () => {
    const sdl = sdlWith({
      web: { env: { TOKEN: null, API_TOKEN: "ac-secret://API_TOKEN", NAME: "abc" }, credentials: { host: "ghcr.io", username: "me", password: null } },
      worker: { env: { TOKEN: "" }, credentials: { host: "ghcr.io" } }
    });
    const askedValues = [
      secretValue("TOKEN", [
        { service: "web", env: "TOKEN" },
        { service: "worker", env: "TOKEN" }
      ]),
      secretValue("API_TOKEN")
    ];

    expect(findSecretValueIssues(sdl, askedValues)).toEqual([]);
  });

  it("accepts a registry password held as a reference", () => {
    const sdl = sdlWith({ web: { credentials: { host: "ghcr.io", username: "me", password: "ac-secret://REGISTRY_PASSWORD" } } });

    expect(findSecretValueIssues(sdl, [])).toEqual([]);
  });

  it("leaves plain variables with values alone", () => {
    const sdl = sdlWith({ web: { env: ["NAME=abc", "PORT=80", "EMPTY=", "BARE"] } });

    expect(findSecretValueIssues(sdl, [textValue("NAME"), textValue("PORT")])).toEqual([]);
  });

  it("ignores entries that are not text", () => {
    const sdl = sdlWith({ web: { env: [1, null, { TOKEN: "x" }, "TOKEN=ac-secret://TOKEN"] } });

    expect(findSecretValueIssues(sdl, [secretValue("TOKEN")])).toEqual([]);
  });

  it("finds nothing in an SDL without services or env", () => {
    expect(findSecretValueIssues("version: '2.0'\n", [secretValue("TOKEN")])).toEqual([]);
    expect(findSecretValueIssues(sdlWith({ web: { image: "nginx" }, bad: "text", list: [] }), [secretValue("TOKEN")])).toEqual([]);
    expect(findSecretValueIssues(sdlWith({ web: { env: "TOKEN=x" } }), [secretValue("TOKEN")])).toEqual([]);
  });

  it("returns nothing for an SDL that cannot be read", () => {
    expect(findSecretValueIssues("services: [unclosed", [secretValue("TOKEN")])).toEqual([]);
    expect(findSecretValueIssues("- just\n- a list\n", [secretValue("TOKEN")])).toEqual([]);
    expect(findSecretValueIssues("plain text", [secretValue("TOKEN")])).toEqual([]);
  });

  it("refuses an SDL whose anchors expand past the submittable length", () => {
    const levels = Array.from({ length: 10 }, (_, level) => `  l${level + 1}: &l${level + 1} [${Array.from({ length: 10 }, () => `*l${level}`).join(", ")}]`);
    const sdl = `x:\n  l0: &l0 [a]\n${levels.join("\n")}\nservices:\n  web:\n    env: *l10\n`;

    expect(findSecretValueIssues(sdl, [secretValue("TOKEN")])).toEqual([expect.stringContaining("SDL is too large")]);
  });

  it("reads an SDL whose small anchor is shared", () => {
    const sdl = ["services:", "  web:", "    env: &env", "      - TOKEN=hunter2", "  worker:", "    env: *env", ""].join("\n");

    expect(findSecretValueIssues(sdl, [secretValue("TOKEN", [{ service: "worker", env: "TOKEN" }])])).toEqual([
      'Variable "TOKEN" is a secret, so worker.env.TOKEN must not carry a value'
    ]);
  });

  function sdlWith(services: Record<string, unknown>) {
    return JSON.stringify({ version: "2.0", services });
  }

  function secretValue(key: string, bindings: AskedValue["bindings"] = [{ service: "web", env: key }]): AskedValue {
    return { type: "secret", key, label: key, required: true, bindings };
  }

  function textValue(key: string): AskedValue {
    return { type: "text", key, label: key, required: true, bindings: [{ service: "web", env: key }] };
  }
});
