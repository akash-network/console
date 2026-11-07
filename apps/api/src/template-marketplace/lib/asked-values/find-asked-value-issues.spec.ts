import { describe, expect, it } from "vitest";

import type { AskedValue } from "./asked-values.schema";
import { findAskedValueIssues } from "./find-asked-value-issues";

describe(findAskedValueIssues.name, () => {
  it("accepts values that fit the SDL", () => {
    const { issues } = setup({
      askedValues: [
        askedValue({ type: "text", key: "NAME", default: "abc", minLength: 1, maxLength: 5 }),
        askedValue({ type: "number", key: "PORT", default: "80", min: 1, max: 100, integer: true, bindings: [{ service: "db", env: "PORT" }] }),
        askedValue({ type: "boolean", key: "DEBUG", default: "true", bindings: [{ service: "db", env: "DEBUG" }] }),
        askedValue({ type: "choice", key: "MODE", choices: ["a", "b"], default: "b", bindings: [{ service: "db", env: "MODE" }] }),
        askedValue({ type: "secret", key: "TOKEN", bindings: [{ service: "db", env: "TOKEN" }] })
      ]
    });

    expect(issues).toEqual([]);
  });

  it("accepts one value filling the same env var in two services", () => {
    const { issues } = setup({
      askedValues: [
        askedValue({
          key: "SHARED",
          bindings: [
            { service: "web", env: "SHARED" },
            { service: "db", env: "SHARED" }
          ]
        })
      ]
    });

    expect(issues).toEqual([]);
  });

  it("accepts different values filling the same env var in different services", () => {
    const { issues } = setup({
      askedValues: [askedValue({ key: "A", bindings: [{ service: "web", env: "X" }] }), askedValue({ key: "B", bindings: [{ service: "db", env: "X" }] })]
    });

    expect(issues).toEqual([]);
  });

  it.each([
    {
      name: "a key declared twice",
      askedValues: [askedValue({ key: "NAME" }), askedValue({ key: "NAME", bindings: [{ service: "db", env: "OTHER" }] })],
      expected: ['Variable "NAME" is declared twice']
    },
    {
      name: "a service the SDL does not define",
      askedValues: [askedValue({ key: "NAME", bindings: [{ service: "cache", env: "NAME" }] })],
      expected: ['Variable "NAME" fills in service "cache", which the SDL does not define']
    },
    {
      name: "two values filling the same env var",
      askedValues: [askedValue({ key: "A", bindings: [{ service: "web", env: "X" }] }), askedValue({ key: "B", bindings: [{ service: "web", env: "X" }] })],
      expected: ['Variables "A" and "B" both fill in web.env.X']
    },
    {
      name: "a number default that is not a number",
      askedValues: [askedValue({ type: "number", key: "N", default: "abc" })],
      expected: ['Variable "N" has a default that is not a number']
    },
    {
      name: "a number default that is blank",
      askedValues: [askedValue({ type: "number", key: "N", default: "  " })],
      expected: ['Variable "N" has a default that is not a number']
    },
    {
      name: "a number default that is not whole",
      askedValues: [askedValue({ type: "number", key: "N", default: "1.5", integer: true })],
      expected: ['Variable "N" has a default that is not a whole number']
    },
    {
      name: "a number default below the minimum",
      askedValues: [askedValue({ type: "number", key: "N", default: "1", min: 2 })],
      expected: ['Variable "N" has a default that is below 2']
    },
    {
      name: "a number default above the maximum",
      askedValues: [askedValue({ type: "number", key: "N", default: "9", max: 8 })],
      expected: ['Variable "N" has a default that is above 8']
    },
    {
      name: "a text default shorter than the minimum length",
      askedValues: [askedValue({ key: "T", default: "ab", minLength: 3 })],
      expected: ['Variable "T" has a default that is shorter than 3 characters']
    },
    {
      name: "a text default longer than the maximum length",
      askedValues: [askedValue({ key: "T", default: "abcd", maxLength: 3 })],
      expected: ['Variable "T" has a default that is longer than 3 characters']
    },
    {
      name: "a choice default that is not a choice",
      askedValues: [askedValue({ type: "choice", key: "C", choices: ["a", "b"], default: "c" })],
      expected: ['Variable "C" has a default that is not one of its choices']
    },
    {
      name: "a number minimum above its maximum",
      askedValues: [askedValue({ type: "number", key: "N", min: 5, max: 1 })],
      expected: ['Variable "N" has a minimum above its maximum']
    },
    {
      name: "a text minimum length above its maximum length",
      askedValues: [askedValue({ key: "T", minLength: 5, maxLength: 1 })],
      expected: ['Variable "T" has a minimum above its maximum']
    }
  ])("reports $name", ({ askedValues, expected }) => {
    expect(setup({ askedValues }).issues).toEqual(expected);
  });

  it("accepts defaults sitting exactly on a limit", () => {
    const { issues } = setup({
      askedValues: [
        askedValue({ type: "number", key: "LOW", default: "2", min: 2, bindings: [{ service: "web", env: "LOW" }] }),
        askedValue({ type: "number", key: "HIGH", default: "8", max: 8, bindings: [{ service: "web", env: "HIGH" }] }),
        askedValue({ type: "number", key: "ZERO", default: "0", bindings: [{ service: "web", env: "ZERO" }] }),
        askedValue({ key: "SHORT", default: "abc", minLength: 3, bindings: [{ service: "web", env: "SHORT" }] }),
        askedValue({ key: "LONG", default: "abc", maxLength: 3, bindings: [{ service: "web", env: "LONG" }] }),
        askedValue({ type: "number", key: "EQ", min: 3, max: 3, bindings: [{ service: "web", env: "EQ" }] })
      ]
    });

    expect(issues).toEqual([]);
  });

  it("reports a key once for every extra time it is declared", () => {
    const { issues } = setup({
      askedValues: [
        askedValue({ key: "NAME", bindings: [{ service: "web", env: "A" }] }),
        askedValue({ key: "NAME", bindings: [{ service: "web", env: "B" }] }),
        askedValue({ key: "NAME", bindings: [{ service: "web", env: "C" }] })
      ]
    });

    expect(issues).toEqual(['Variable "NAME" is declared twice', 'Variable "NAME" is declared twice']);
  });

  it("does not report a key colliding with itself", () => {
    const { issues } = setup({ askedValues: [askedValue({ key: "NAME" }), askedValue({ key: "NAME" })] });

    expect(issues).toEqual(['Variable "NAME" is declared twice']);
  });

  it("accepts a choice and a text value that have no default", () => {
    const { issues } = setup({
      askedValues: [
        askedValue({ type: "choice", key: "MODE", choices: ["a"], bindings: [{ service: "web", env: "MODE" }] }),
        askedValue({ key: "TEXT", minLength: 3, maxLength: 4, bindings: [{ service: "web", env: "TEXT" }] })
      ]
    });

    expect(issues).toEqual([]);
  });

  it("reports problems in declaration order", () => {
    const { issues } = setup({
      askedValues: [
        askedValue({ type: "number", key: "A", default: "x", bindings: [{ service: "cache", env: "A" }] }),
        askedValue({ type: "number", key: "B", default: "3", min: 5, max: 2, bindings: [{ service: "web", env: "A" }] })
      ]
    });

    expect(issues).toEqual([
      'Variable "A" fills in service "cache", which the SDL does not define',
      'Variable "A" has a default that is not a number',
      'Variable "B" has a minimum above its maximum',
      'Variable "B" has a default that is below 5',
      'Variable "B" has a default that is above 2'
    ]);
  });

  it("reports an env var collision once per extra value filling it", () => {
    const { issues } = setup({
      askedValues: [
        askedValue({ key: "A", bindings: [{ service: "web", env: "X" }] }),
        askedValue({ key: "B", bindings: [{ service: "web", env: "X" }] }),
        askedValue({ key: "C", bindings: [{ service: "web", env: "X" }] })
      ]
    });

    expect(issues).toEqual(['Variables "A" and "B" both fill in web.env.X', 'Variables "A" and "C" both fill in web.env.X']);
  });

  it("reports one message for an SDL that cannot be read", () => {
    expect(setup({ sdl: "services: [unclosed", askedValues: [askedValue({ key: "A" }), askedValue({ key: "A" })] }).issues).toEqual([
      "The SDL could not be read"
    ]);
    expect(setup({ sdl: "just a string", askedValues: [askedValue({})] }).issues).toEqual(["The SDL could not be read"]);
    expect(setup({ sdl: "- services\n- web", askedValues: [askedValue({})] }).issues).toEqual(["The SDL could not be read"]);
  });

  it("treats an SDL without services as defining none", () => {
    expect(setup({ sdl: "version: '2.0'", askedValues: [askedValue({ key: "NAME" })] }).issues).toEqual([
      'Variable "NAME" fills in service "web", which the SDL does not define'
    ]);
  });

  it("never changes the SDL text", () => {
    const sdl = 'services:\n  web:\n    env:\n      - NAME={{ NAME }}\n';
    const { issues } = setup({ sdl, askedValues: [askedValue({ key: "NAME" })] });

    expect(issues).toEqual([]);
    expect(sdl).toBe('services:\n  web:\n    env:\n      - NAME={{ NAME }}\n');
  });

  function setup(input: { sdl?: string; askedValues: AskedValue[] }) {
    const sdl = input.sdl ?? "version: '2.0'\nservices:\n  web:\n    image: nginx\n  db:\n    image: postgres\n";
    return { issues: findAskedValueIssues(sdl, input.askedValues) };
  }

  function askedValue(overrides: Record<string, unknown> = {}): AskedValue {
    return {
      type: "text",
      key: "NAME",
      label: "Name",
      required: true,
      bindings: [{ service: "web", env: "NAME" }],
      ...overrides
    } as AskedValue;
  }
});
