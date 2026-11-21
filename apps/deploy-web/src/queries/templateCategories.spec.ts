import { describe, expect, it } from "vitest";

import { toCategoriesAndTemplates } from "./templateCategories";

describe(toCategoriesAndTemplates.name, () => {
  it("names each template's category on it and lists every template once per category", () => {
    const llama = { id: "llama", name: "Llama", summary: "Chat", deploy: "" };
    const grafana = { id: "grafana", name: "Grafana", summary: "Dashboards", deploy: "" };

    expect(
      toCategoriesAndTemplates([
        { title: "AI - GPU", templates: [llama] },
        { title: "Tools", templates: [grafana, llama] }
      ])
    ).toEqual({
      categories: [
        { title: "AI - GPU", templates: [{ ...llama, category: "AI - GPU" }] },
        {
          title: "Tools",
          templates: [
            { ...grafana, category: "Tools" },
            { ...llama, category: "Tools" }
          ]
        }
      ],
      templates: [
        { ...llama, category: "AI - GPU" },
        { ...grafana, category: "Tools" },
        { ...llama, category: "Tools" }
      ]
    });
  });

  it("drops a category that lists nothing", () => {
    const result = toCategoriesAndTemplates([
      { title: "Empty", templates: [] },
      { title: "Tools", templates: [{ id: "grafana", name: "Grafana", summary: "Dashboards", deploy: "" }] }
    ]);

    expect(result.categories.map(category => category.title)).toEqual(["Tools"]);
  });

  it("reads a missing list as no categories and no templates", () => {
    expect(toCategoriesAndTemplates(undefined)).toEqual({ categories: [], templates: [] });
  });
});
