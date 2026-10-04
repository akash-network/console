import React from "react";
import { describe, expect, it } from "vitest";

import type { TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import { TemplateBox } from "./TemplateBox";

import { render, screen } from "@testing-library/react";

describe(TemplateBox.name, () => {
  it("renders template name and summary", () => {
    setup();

    expect(screen.getByText("My Template")).toBeInTheDocument();
    expect(screen.getByText("A brief summary")).toBeInTheDocument();
  });

  it("renders a link to the template details page", () => {
    setup();

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/templates/template-123");
  });

  it("renders a custom linkHref when provided", () => {
    setup({ linkHref: "/custom-link" });

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/custom-link");
  });

  function setup(input: { linkHref?: string } = {}) {
    const template: TemplateOutputSummaryWithCategory = {
      id: "template-123",
      name: "My Template",
      summary: "A brief summary",
      deploy: "",
      logoUrl: null,
      category: "AI & ML"
    };
    render(<TemplateBox template={template} linkHref={input.linkHref} />);
  }
});
