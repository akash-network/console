import React from "react";
import { describe, expect, it } from "vitest";

import type { TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import { TemplateCard } from "./TemplateCard";

import { render, screen } from "@testing-library/react";

describe(TemplateCard.name, () => {
  it("links to the template's detail page", () => {
    setup({ isPopular: false });

    expect(screen.getByRole("link", { name: /Llama 3/ })).toHaveAttribute("href", "/templates/akash-network-awesome-akash-llama-3");
  });

  it("shows the template's name and summary", () => {
    setup({ isPopular: false });

    expect(screen.getByRole("heading", { name: "Llama 3" })).toBeInTheDocument();
    expect(screen.getByText("Chat with an open model")).toBeInTheDocument();
  });

  it("shows the Popular badge for a popular template", () => {
    setup({ isPopular: true });

    expect(screen.getByText("Popular")).toBeInTheDocument();
  });

  it("shows no badge for other templates", () => {
    setup({ isPopular: false });

    expect(screen.queryByText("Popular")).not.toBeInTheDocument();
  });

  function setup(input: { isPopular: boolean }) {
    const template: TemplateOutputSummaryWithCategory = {
      id: "akash-network-awesome-akash-llama-3",
      name: "Llama 3",
      summary: "Chat with an open model",
      deploy: "",
      logoUrl: null,
      category: "AI - GPU"
    };
    render(<TemplateCard template={template} isPopular={input.isPopular} />);
  }
});
