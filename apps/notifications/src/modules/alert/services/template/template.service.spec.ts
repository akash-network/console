import { describe, expect, it } from "vitest";

import { TemplateService } from "./template.service";

describe(TemplateService.name, () => {
  it("should replace simple variable", () => {
    const template = "Hello {{ name }}!";
    const context = { name: "Alice" };
    expect(new TemplateService().interpolate(template, context)).toBe("Hello Alice!");
  });

  it("should replace multiple variables", () => {
    const template = "{{ greeting }}, {{ name }}!";
    const context = { greeting: "Hi", name: "Bob" };
    expect(new TemplateService().interpolate(template, context)).toBe("Hi, Bob!");
  });

  it("should support nested properties", () => {
    const template = "User: {{ user.name }}, Age: {{ user.age }}";
    const context = { user: { name: "Charlie", age: 30 } };
    expect(new TemplateService().interpolate(template, context)).toBe("User: Charlie, Age: 30");
  });

  it("should ignore unknown variables and leave blank", () => {
    const template = "Hello {{ name }} {{ surname }}";
    const context = { name: "Dana" };
    expect(new TemplateService().interpolate(template, context)).toBe("Hello Dana ");
  });

  it("should handle null and undefined as blank", () => {
    const template = "A: {{ a }}, B: {{ b }}";
    const context = { a: null, b: undefined };
    expect(new TemplateService().interpolate(template, context)).toBe("A: , B: ");
  });

  it("should return original string if no placeholders exist", () => {
    const template = "Static string";
    const context = { name: "Eve" };
    expect(new TemplateService().interpolate(template, context)).toBe("Static string");
  });

  it("should coerce numbers and booleans to string", () => {
    const template = "Age: {{ age }}, Active: {{ active }}";
    const context = { age: 25, active: true };
    expect(new TemplateService().interpolate(template, context)).toBe("Age: 25, Active: true");
  });

  it("should not allow access to globalThis variables", () => {
    const template = "Global: {{ globalThis.process.env.SECRET }}";
    const context = {};
    expect(new TemplateService().interpolate(template, context)).toBe("Global: ");
  });

  it("should not allow access to global variables", () => {
    const template = "Global: {{ global.process.env.SECRET }}";
    const context = {};
    expect(new TemplateService().interpolate(template, context)).toBe("Global: ");
  });

  it("should not allow access to process.env or Node globals", () => {
    const template = "Env: {{ process.env.PATH }}";
    const context = {};
    expect(new TemplateService().interpolate(template, context)).toBe("Env: ");
  });
});
