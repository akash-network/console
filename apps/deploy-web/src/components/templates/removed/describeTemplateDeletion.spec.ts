import { describe, expect, it } from "vitest";

import { describeTemplateDeletion } from "./describeTemplateDeletion";

const NEVER_PUBLIC = "The template and all its versions are deleted for everyone in the organization.";

describe(describeTemplateDeletion.name, () => {
  it("says what happens to the gallery entry, the link and running deployments of a template that was public once", () => {
    const description = describeTemplateDeletion({ publishedAt: "2026-11-02T10:00:00.000Z" }, NEVER_PUBLIC);

    expect(description).toContain("It leaves the gallery");
    expect(description).toContain("anyone who opens its link is told it was removed");
    expect(description).toContain("Deployments made from it keep running");
    expect(description).toContain("This can't be undone");
  });

  it("keeps the caller's wording for a template that was never public", () => {
    expect(describeTemplateDeletion({ publishedAt: null }, NEVER_PUBLIC)).toBe(NEVER_PUBLIC);
  });
});
