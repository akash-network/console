import { describe, expect, it } from "vitest";

import type { AskedValue } from "./asked-values.schema";
import { findAskedValueIssues } from "./find-asked-value-issues";

describe(findAskedValueIssues.name, () => {
  it("accepts values that fit the SDL", () => {
    const { issues } = setup({
      askedValues: [
        textValue({ key: "NAME", default: "abc", minLength: 1, maxLength: 5 }),
        numberValue({ key: "PORT", default: "80", min: 1, max: 100, integer: true, bindings: [{ service: "db", env: "PORT" }] }),
        booleanValue({ key: "DEBUG", default: "true", bindings: [{ service: "db", env: "DEBUG" }] }),
        choiceValue({ key: "MODE", choices: ["a", "b"], default: "b", bindings: [{ service: "db", env: "MODE" }] }),
        secretValue({ key: "TOKEN", bindings: [{ service: "db", env: "TOKEN" }] })
      ]
    });

    expect(issues).toEqual([]);
  });

  it("accepts one value filling the same env var in two services", () => {
    const { issues } = setup({
      askedValues: [
        textValue({
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
      askedValues: [textValue({ key: "A", bindings: [{ service: "web", env: "X" }] }), textValue({ key: "B", bindings: [{ service: "db", env: "X" }] })]
    });

    expect(issues).toEqual([]);
  });

  it.each([
    {
      name: "a key declared twice",
      askedValues: [textValue({ key: "NAME" }), textValue({ key: "NAME", bindings: [{ service: "db", env: "OTHER" }] })],
      expected: ['Variable "NAME" is declared twice']
    },
    {
      name: "a service the SDL does not define",
      askedValues: [textValue({ key: "NAME", bindings: [{ service: "cache", env: "NAME" }] })],
      expected: ['Variable "NAME" fills in service "cache", which the SDL does not define']
    },
    {
      name: "two values filling the same env var",
      askedValues: [textValue({ key: "A", bindings: [{ service: "web", env: "X" }] }), textValue({ key: "B", bindings: [{ service: "web", env: "X" }] })],
      expected: ['Variables "A" and "B" both fill in web.env.X']
    },
    {
      name: "a number default that is not a number",
      askedValues: [numberValue({ key: "N", default: "abc" })],
      expected: ['Variable "N" has a default that is not a number']
    },
    {
      name: "a number default that is blank",
      askedValues: [numberValue({ key: "N", default: "  " })],
      expected: ['Variable "N" has a default that is not a number']
    },
    {
      name: "a number default that is not whole",
      askedValues: [numberValue({ key: "N", default: "1.5", integer: true })],
      expected: ['Variable "N" has a default that is not a whole number']
    },
    {
      name: "a number default below the minimum",
      askedValues: [numberValue({ key: "N", default: "1", min: 2 })],
      expected: ['Variable "N" has a default that is below 2']
    },
    {
      name: "a number default above the maximum",
      askedValues: [numberValue({ key: "N", default: "9", max: 8 })],
      expected: ['Variable "N" has a default that is above 8']
    },
    {
      name: "a text default shorter than the minimum length",
      askedValues: [textValue({ key: "T", default: "ab", minLength: 3 })],
      expected: ['Variable "T" has a default that is shorter than 3 characters']
    },
    {
      name: "a text default longer than the maximum length",
      askedValues: [textValue({ key: "T", default: "abcd", maxLength: 3 })],
      expected: ['Variable "T" has a default that is longer than 3 characters']
    },
    {
      name: "a choice default that is not a choice",
      askedValues: [choiceValue({ key: "C", choices: ["a", "b"], default: "c" })],
      expected: ['Variable "C" has a default that is not one of its choices']
    },
    {
      name: "a number minimum above its maximum",
      askedValues: [numberValue({ key: "N", min: 5, max: 1 })],
      expected: ['Variable "N" has a minimum above its maximum']
    },
    {
      name: "a text minimum length above its maximum length",
      askedValues: [textValue({ key: "T", minLength: 5, maxLength: 1 })],
      expected: ['Variable "T" has a minimum above its maximum']
    }
  ])("reports $name", ({ askedValues, expected }) => {
    expect(setup({ askedValues }).issues).toEqual(expected);
  });

  it.each(["Infinity", "0x10", "1e3", " 5 ", "5.", ".5", "+5", "1,5", "--1"])("treats the number default %j as not a number", value => {
    expect(setup({ askedValues: [numberValue({ key: "N", default: value })] }).issues).toEqual(['Variable "N" has a default that is not a number']);
  });

  it.each(["0", "5", "-5", "1.25", "-0.5", "007"])("accepts the plain decimal number default %j", value => {
    expect(setup({ askedValues: [numberValue({ default: value })] }).issues).toEqual([]);
  });

  it("does not read the SDL when no values are asked", () => {
    expect(setup({ sdl: "services: [unclosed", askedValues: [] }).issues).toEqual([]);
  });

  it("accepts defaults sitting exactly on a limit", () => {
    const { issues } = setup({
      askedValues: [
        numberValue({ key: "LOW", default: "2", min: 2, bindings: [{ service: "web", env: "LOW" }] }),
        numberValue({ key: "HIGH", default: "8", max: 8, bindings: [{ service: "web", env: "HIGH" }] }),
        numberValue({ key: "ZERO", default: "0", bindings: [{ service: "web", env: "ZERO" }] }),
        textValue({ key: "SHORT", default: "abc", minLength: 3, bindings: [{ service: "web", env: "SHORT" }] }),
        textValue({ key: "LONG", default: "abc", maxLength: 3, bindings: [{ service: "web", env: "LONG" }] }),
        numberValue({ key: "EQ", min: 3, max: 3, bindings: [{ service: "web", env: "EQ" }] })
      ]
    });

    expect(issues).toEqual([]);
  });

  it("reports a key once for every extra time it is declared", () => {
    const { issues } = setup({
      askedValues: [
        textValue({ key: "NAME", bindings: [{ service: "web", env: "A" }] }),
        textValue({ key: "NAME", bindings: [{ service: "web", env: "B" }] }),
        textValue({ key: "NAME", bindings: [{ service: "web", env: "C" }] })
      ]
    });

    expect(issues).toEqual(['Variable "NAME" is declared twice', 'Variable "NAME" is declared twice']);
  });

  it("does not report a key colliding with itself", () => {
    const { issues } = setup({ askedValues: [textValue({ key: "NAME" }), textValue({ key: "NAME" })] });

    expect(issues).toEqual(['Variable "NAME" is declared twice']);
  });

  it("accepts a choice and a text value that have no default", () => {
    const { issues } = setup({
      askedValues: [
        choiceValue({ key: "MODE", choices: ["a"], bindings: [{ service: "web", env: "MODE" }] }),
        textValue({ key: "TEXT", minLength: 3, maxLength: 4, bindings: [{ service: "web", env: "TEXT" }] })
      ]
    });

    expect(issues).toEqual([]);
  });

  it("reports problems in declaration order", () => {
    const { issues } = setup({
      askedValues: [
        numberValue({ key: "A", default: "x", bindings: [{ service: "cache", env: "A" }] }),
        numberValue({ key: "B", default: "3", min: 5, max: 2, bindings: [{ service: "web", env: "A" }] })
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
        textValue({ key: "A", bindings: [{ service: "web", env: "X" }] }),
        textValue({ key: "B", bindings: [{ service: "web", env: "X" }] }),
        textValue({ key: "C", bindings: [{ service: "web", env: "X" }] })
      ]
    });

    expect(issues).toEqual(['Variables "A" and "B" both fill in web.env.X', 'Variables "A" and "C" both fill in web.env.X']);
  });

  it("reports one message for an SDL that cannot be read", () => {
    expect(setup({ sdl: "services: [unclosed", askedValues: [textValue({ key: "A" })] }).issues).toEqual(["The SDL could not be read"]);
    expect(setup({ sdl: "just a string", askedValues: [textValue({})] }).issues).toEqual(["The SDL could not be read"]);
    expect(setup({ sdl: "- services\n- web", askedValues: [textValue({})] }).issues).toEqual(["The SDL could not be read"]);
  });

  it("treats an SDL without services as defining none", () => {
    expect(setup({ sdl: "version: '2.0'", askedValues: [textValue({ key: "NAME" })] }).issues).toEqual([
      'Variable "NAME" fills in service "web", which the SDL does not define'
    ]);
  });

  it("never changes the SDL text", () => {
    const sdl = "services:\n  web:\n    env:\n      - NAME={{ NAME }}\n";
    const { issues } = setup({ sdl, askedValues: [textValue({ key: "NAME" })] });

    expect(issues).toEqual([]);
    expect(sdl).toBe("services:\n  web:\n    env:\n      - NAME={{ NAME }}\n");
  });

  function setup(input: { sdl?: string; askedValues: AskedValue[] }) {
    const sdl = input.sdl ?? "version: '2.0'\nservices:\n  web:\n    image: nginx\n  db:\n    image: postgres\n";
    return { issues: findAskedValueIssues(sdl, input.askedValues) };
  }

  type ValueOf<Type extends AskedValue["type"]> = Extract<AskedValue, { type: Type }>;

  function textValue(overrides: Partial<ValueOf<"text">> = {}): AskedValue {
    return { ...commonFields(), type: "text", ...overrides };
  }

  function numberValue(overrides: Partial<ValueOf<"number">> = {}): AskedValue {
    return { ...commonFields(), type: "number", ...overrides };
  }

  function booleanValue(overrides: Partial<ValueOf<"boolean">> = {}): AskedValue {
    return { ...commonFields(), type: "boolean", ...overrides };
  }

  function choiceValue(overrides: Partial<ValueOf<"choice">> = {}): AskedValue {
    return { ...commonFields(), type: "choice", choices: ["a", "b"], ...overrides };
  }

  function secretValue(overrides: Partial<ValueOf<"secret">> = {}): AskedValue {
    return { ...commonFields(), type: "secret", ...overrides };
  }

  function commonFields() {
    return { key: "NAME", label: "Name", required: true, bindings: [{ service: "web", env: "NAME" }] };
  }
});
