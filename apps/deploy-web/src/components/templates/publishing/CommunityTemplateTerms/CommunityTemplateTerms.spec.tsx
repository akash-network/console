import { describe, expect, it } from "vitest";

import { CommunityTemplateTerms } from "./CommunityTemplateTerms";

import { render, screen } from "@testing-library/react";

describe(CommunityTemplateTerms.name, () => {
  it("states what the publisher agrees to and which version", () => {
    render(<CommunityTemplateTerms version="2026-11" />);

    expect(screen.getByText("Read the community template terms")).toBeInTheDocument();
    expect(screen.getByText(/Anyone can find, deploy and fork a public template/)).toBeInTheDocument();
    expect(screen.getByText(/Akash can hide or remove a public template/)).toBeInTheDocument();
    expect(screen.getByText("Terms version 2026-11")).toBeInTheDocument();
  });

  it("links to the prohibited uses in the Terms of Service", () => {
    render(<CommunityTemplateTerms version="2026-11" />);

    const link = screen.getByRole("link", { name: "Terms of Service", hidden: true });
    expect(link).toHaveAttribute("href", "/terms-of-service#prohibited-use");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
