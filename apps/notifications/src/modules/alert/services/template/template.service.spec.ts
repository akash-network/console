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

  describe("denomLabel helper", () => {
    it("should map known denoms to token labels", () => {
      const template = "{{denomLabel denom}}";
      expect(setup().interpolate(template, { denom: "uakt" })).toBe("AKT");
      expect(setup().interpolate(template, { denom: "uact" })).toBe("ACT");
    });

    it("should return denom as-is if unknown", () => {
      expect(setup().interpolate("{{denomLabel denom}}", { denom: "ufoo" })).toBe("ufoo");
    });
  });

  describe("udenomToDenom helper", () => {
    it("should convert micro-denomination to denom", () => {
      const template = "{{udenomToDenom balance}}";
      expect(setup().interpolate(template, { balance: 700_000 })).toBe("0.7");
    });

    it("should accept custom precision as second argument", () => {
      expect(setup().interpolate("{{udenomToDenom balance 2}}", { balance: 1_234_567 })).toBe("1.23");
    });
  });

  describe("balance alert template", () => {
    const template =
      '{{#if (eq alert.next.status "TRIGGERED")}}Balance dropped to {{udenomToDenom data.amount 2}} {{denomLabel data.denom}}, which is below the configured threshold{{else}}Balance recovered to {{udenomToDenom data.amount 2}} {{denomLabel data.denom}}, now above threshold{{/if}}';

    it("should render triggered alert", () => {
      const context = {
        alert: { next: { status: "TRIGGERED" } },
        data: { amount: 700_000, denom: "uakt" }
      };
      expect(setup().interpolate(template, context)).toBe("Balance dropped to 0.7 AKT, which is below the configured threshold");
    });

    it("should render recovered alert", () => {
      const context = {
        alert: { next: { status: "OK" } },
        data: { amount: 5_000_000, denom: "uact" }
      };
      expect(setup().interpolate(template, context)).toBe("Balance recovered to 5 ACT, now above threshold");
    });
  });

  function setup() {
    return new TemplateService();
  }
});
