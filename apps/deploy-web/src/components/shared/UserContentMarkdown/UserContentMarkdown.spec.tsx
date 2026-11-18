import type { PluggableList } from "react-markdown/lib/react-markdown";
import { describe, expect, it, vi } from "vitest";

import { rehypeHardenUserContent } from "./rehypeHardenUserContent";
import { DEPENDENCIES, UserContentMarkdown } from "./UserContentMarkdown";

import { render, screen } from "@testing-library/react";
import { findActiveContent, findUnsafeUserLinks, USER_CONTENT_ATTACKS } from "@tests/unit/userContentAttacks";

type HastNode = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: HastNode[] };

const README = [
  "# Open WebUI",
  "",
  "A private chat app. See the [docs](https://docs.openwebui.com/) or write to <team@openwebui.com>.",
  "",
  "![Screenshot](https://raw.githubusercontent.com/open-webui/open-webui/main/demo.png)",
  "",
  "- [x] Runs on one GPU",
  "- [ ] Needs a domain",
  "",
  "| Port | Use |",
  "| ---- | --- |",
  "| 8080 | Web |",
  "",
  "```yaml",
  "services:",
  "  web:",
  "    image: ghcr.io/open-webui/open-webui:0.4.8",
  "```"
].join("\n");

describe("UserContentMarkdown", () => {
  it.each(USER_CONTENT_ATTACKS)("renders $name as inert content", ({ payload }) => {
    const { container } = setup({ markdown: payload });

    expect(findActiveContent(container)).toEqual([]);
    expect(findUnsafeUserLinks(container)).toEqual([]);
  });

  it.each([
    ["a heading", (payload: string) => `# ${payload}`],
    ["a list item", (payload: string) => `- ${payload}`],
    ["a quote", (payload: string) => `> ${payload}`],
    ["emphasis", (payload: string) => `**${payload}**`],
    ["a table cell", (payload: string) => `| Name |\n| ---- |\n| ${payload.replaceAll("\n", " ").replaceAll("|", "\\|")} |`],
    ["a code block", (payload: string) => `\`\`\`html\n${payload}\n\`\`\``]
  ])("renders every attack as inert content inside %s", (_, wrap) => {
    const { container } = setup({ markdown: USER_CONTENT_ATTACKS.map(({ payload }) => wrap(payload)).join("\n\n") });

    expect(findActiveContent(container)).toEqual([]);
    expect(findUnsafeUserLinks(container)).toEqual([]);
  });

  it("shows raw HTML as the text that was written", () => {
    const { container } = setup({ markdown: 'Use <b>bold</b> or\n\n<div align="center"><script>alert(1)</script></div>' });

    expect(container.textContent).toContain("<b>bold</b>");
    expect(container.textContent).toContain('<div align="center"><script>alert(1)</script></div>');
    expect(container.querySelector("b, div[align], script")).toBeNull();
  });

  it("never asks the markdown component to render HTML", () => {
    const { Markdown } = setup({ markdown: "<b>bold</b>" });

    expect(Markdown).toHaveBeenCalledWith(expect.not.objectContaining({ hasHtml: expect.anything() }), expect.anything());
  });

  it("renders the markdown a README is written in", () => {
    const { container } = setup({ markdown: README });

    expect(screen.getByRole("heading", { name: "Open WebUI" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "docs" })).toHaveAttribute("href", "https://docs.openwebui.com/");
    expect(screen.getByRole("link", { name: "team@openwebui.com" })).toHaveAttribute("href", "mailto:team@openwebui.com");
    expect(screen.getByRole("img", { name: "Screenshot" })).toHaveAttribute("src", "https://raw.githubusercontent.com/open-webui/open-webui/main/demo.png");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByRole("cell", { name: "8080" })).toBeInTheDocument();
    expect(container.querySelector("pre code.language-yaml .hljs-attr")).not.toBeNull();
    expect(findActiveContent(container)).toEqual([]);
    expect(findUnsafeUserLinks(container)).toEqual([]);
  });

  it("styles the content with the classes it is given", () => {
    const { container } = setup({ markdown: "Hello", className: "prose-sm" });

    expect(container.firstElementChild).toHaveClass("prose", "prose-sm");
  });

  it("hardens what the plugins it is given put in the content", () => {
    const addScriptLink = () => (tree: HastNode) => {
      tree.children?.push({
        type: "element",
        tagName: "a",
        properties: { href: "javascript:alert(1)" },
        children: [{ type: "text", value: "added later" }]
      });
    };
    const { container, Markdown } = setup({ markdown: "Hello", rehypePlugins: [addScriptLink] });

    expect(container.textContent).toContain("added later");
    expect(container.querySelector("a")).toBeNull();
    expect(Markdown.mock.calls[0][0].rehypePlugins).toEqual([addScriptLink, rehypeHardenUserContent]);
  });

  function setup(input: { markdown: string; className?: string; rehypePlugins?: PluggableList }) {
    const Markdown = vi.fn(DEPENDENCIES.Markdown);
    const { container } = render(
      <UserContentMarkdown className={input.className} rehypePlugins={input.rehypePlugins} dependencies={{ Markdown }}>
        {input.markdown}
      </UserContentMarkdown>
    );

    return { container, Markdown };
  }
});
