import { describe, expect, it } from "vitest";

import { describeAwesomeAkashTemplate, describeConsoleTemplate } from "./templateEvents";

import { buildMarketplaceTemplate } from "@tests/seeders/userTemplate";

describe(describeConsoleTemplate.name, () => {
  it("calls a public template community", () => {
    const template = buildMarketplaceTemplate({ id: "tpl-1", visibility: "public", isOfficial: false });

    expect(describeConsoleTemplate(template, 3)).toEqual({ source: "community", templateId: "tpl-1", templateVersion: 3 });
  });

  it.each(["private", "organization"] as const)("calls a template whose visibility is %s private", visibility => {
    expect(describeConsoleTemplate(buildMarketplaceTemplate({ visibility, isOfficial: false }), 1).source).toBe("private");
  });

  it.each(["public", "private", "organization"] as const)("calls a template staff promoted official, whatever its visibility (%s)", visibility => {
    expect(describeConsoleTemplate(buildMarketplaceTemplate({ visibility, isOfficial: true }), 1).source).toBe("official");
  });

  it.each([null, undefined])("sends no version for a template that has none (%s)", templateVersion => {
    expect(describeConsoleTemplate(buildMarketplaceTemplate(), templateVersion).templateVersion).toBeNull();
  });

  it("carries nothing an author wrote", () => {
    const template = buildMarketplaceTemplate({ id: "tpl-1", title: "Secret title", summary: "Secret summary", visibility: "public" });

    expect(Object.keys(describeConsoleTemplate(template, 2)).sort()).toEqual(["source", "templateId", "templateVersion"]);
    expect(JSON.stringify(describeConsoleTemplate(template, 2))).not.toContain("Secret");
  });
});

describe(describeAwesomeAkashTemplate.name, () => {
  it("calls an awesome-akash template official, without a version", () => {
    expect(describeAwesomeAkashTemplate("akash-network-awesome-akash-llama.cpp_2")).toEqual({
      source: "official",
      templateId: "akash-network-awesome-akash-llama.cpp_2",
      templateVersion: null
    });
  });

  it("accepts an id of 255 characters and refuses one of 256", () => {
    expect(describeAwesomeAkashTemplate("a".repeat(255))?.templateId).toBe("a".repeat(255));
    expect(describeAwesomeAkashTemplate("a".repeat(256))).toBeUndefined();
  });

  it.each([undefined, "", "has space", "-leading-dash", ".leading-dot", "slash/inside", "trailing\n", "<script>", "émoji"])(
    "sends nothing for an id that is not shaped like one (%j)",
    templateId => {
      expect(describeAwesomeAkashTemplate(templateId)).toBeUndefined();
    }
  );
});
