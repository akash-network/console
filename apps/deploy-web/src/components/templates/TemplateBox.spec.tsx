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

  it("shows Recommended badge when isRecommended is true", () => {
    setup({ isRecommended: true });

    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.queryByText("Popular")).not.toBeInTheDocument();
  });

  it("shows Popular badge when isPopular is true and isRecommended is false", () => {
    setup({ isPopular: true });

    expect(screen.getByText("Popular")).toBeInTheDocument();
    expect(screen.queryByText("Recommended")).not.toBeInTheDocument();
  });

  it("shows only Recommended badge when both isRecommended and isPopular are true", () => {
    setup({ isRecommended: true, isPopular: true });

    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.queryByText("Popular")).not.toBeInTheDocument();
  });

  it("shows no badge by default", () => {
    setup();

    expect(screen.queryByText("Recommended")).not.toBeInTheDocument();
    expect(screen.queryByText("Popular")).not.toBeInTheDocument();
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

  function setup(input: { isRecommended?: boolean; isPopular?: boolean; linkHref?: string } = {}) {
    const template: TemplateOutputSummaryWithCategory = {
      id: "template-123",
      name: "My Template",
      summary: "A brief summary",
      deploy: "",
      logoUrl: null,
      category: "AI & ML"
    };
    render(<TemplateBox template={template} isRecommended={input.isRecommended} isPopular={input.isPopular} linkHref={input.linkHref} />);
  }
});
