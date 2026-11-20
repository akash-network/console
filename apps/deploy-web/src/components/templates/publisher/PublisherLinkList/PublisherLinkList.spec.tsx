import React from "react";
import { describe, expect, it } from "vitest";

import type { TemplatePublisherLink } from "@src/types/marketplace-template";
import { PublisherLinkList } from "./PublisherLinkList";

import { render, screen, within } from "@testing-library/react";

const HOSTILE_MARKUP = '<img src=x onerror="alert(1)"><script>alert(2)</script>';

describe(PublisherLinkList.name, () => {
  it("lists each link by its host, opening in a new tab without passing anything to the site", () => {
    setup({
      links: [
        { url: "https://lambdagarage.dev/", label: null },
        { url: "https://github.com/lambda-garage", label: null }
      ]
    });

    const links = within(screen.getByRole("list", { name: "Links" })).getAllByRole("link");
    expect(links.map(link => link.getAttribute("href"))).toEqual(["https://lambdagarage.dev/", "https://github.com/lambda-garage"]);
    expect(links[0]).toHaveTextContent("lambdagarage.dev");
    expect(links[1]).toHaveTextContent("github.com/lambda-garage");
    links.forEach(link => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow ugc");
    });
  });

  it("shows the site a labelled link really opens", () => {
    setup({ links: [{ url: "https://evil.example.org/login", label: "github.com/akash-network" }] });

    const link = screen.getByRole("link", { name: /github\.com\/akash-network/ });
    expect(link).toHaveAttribute("href", "https://evil.example.org/login");
    expect(link).toHaveTextContent("· evil.example.org");
  });

  it("shows an address that is not http or https as text, with nothing to click", () => {
    setup({ links: [{ url: "javascript:alert(1)", label: "Docs" }] });

    expect(screen.getByText("Docs")).toBeInTheDocument();
    expect(screen.getByText("· javascript:alert(1)")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links what it can and leaves the rest as text", () => {
    setup({
      links: [
        { url: "data:text/html,<b>x</b>", label: null },
        { url: "https://lambdagarage.dev/", label: null }
      ]
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("data:text/html,<b>x</b>")).toBeInTheDocument();
  });

  it("renders markup in a label and in an address as text", () => {
    const { container } = setup({
      links: [
        { url: "https://lambdagarage.dev/", label: HOSTILE_MARKUP },
        { url: HOSTILE_MARKUP, label: null }
      ]
    });

    expect(screen.getAllByText(HOSTILE_MARKUP)).toHaveLength(2);
    expect(container.querySelector("img, script, b")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("renders nothing without links", () => {
    const { container } = setup({ links: [] });

    expect(container).toBeEmptyDOMElement();
  });

  function setup(input: { links: TemplatePublisherLink[] }) {
    return render(<PublisherLinkList links={input.links} />);
  }
});
