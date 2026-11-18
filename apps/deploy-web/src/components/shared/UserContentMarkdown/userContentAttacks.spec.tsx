import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";

import { render } from "@testing-library/react";
import { findActiveContent, findUnsafeUserLinks, MARKDOWN_ATTACKS, MARKUP_ATTACKS } from "@tests/unit/userContentAttacks";

describe("user content attack checks", () => {
  it("report the active content a renderer lets through when it trusts the markup", () => {
    const { container } = setup({ renderer: "html", content: MARKUP_ATTACKS.map(({ payload }) => payload) });

    expect(findActiveContent(container)).toEqual(
      expect.arrayContaining([
        "<script> element",
        "<iframe> element",
        "<style> element",
        "<link> element",
        "<form> element",
        "<meta> element",
        "<base> element",
        "<object> element",
        "<embed> element",
        "<math> element",
        "<video> element",
        "<source> element",
        "onerror attribute on <img>",
        "onload attribute on <svg>",
        "onfocus attribute on <input>",
        "ontoggle attribute on <details>",
        "srcdoc attribute on <iframe>",
        'href="javascript:alert(1)" on <a>',
        'xlink:href="javascript:alert(1)" on <a>',
        'src="javascript:alert(1)" on <iframe>',
        "image fetched from x",
        "image fetched from https://attacker.example/pixel.gif"
      ])
    );
  });

  it("report the images a markdown renderer fetches from anywhere", () => {
    const { container } = setup({ renderer: "markdown", content: MARKDOWN_ATTACKS.map(({ payload }) => payload) });

    expect(findActiveContent(container)).toEqual(
      expect.arrayContaining([
        "image fetched from https://attacker.example/pixel.gif",
        "image fetched from //attacker.example/pixel.gif",
        "image fetched from /api/auth/logout",
        "image fetched from http://raw.githubusercontent.com/attacker/repo/main/logo.png",
        "image fetched from https://github.com/login/oauth/authorize?client_id=attacker",
        "image fetched from data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+",
        'src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+" on <img>'
      ])
    );
  });

  it.each([
    "link that is not an absolute http(s) or mailto address",
    "link that opens in the same tab",
    "link not marked as user content",
    "link drawn as an image",
    "link with a title",
    "link labelled as Console that goes elsewhere",
    "text that overrides its reading direction"
  ])("report a %s from a markdown renderer that does not harden links", issue => {
    const { container } = setup({ renderer: "markdown", content: MARKDOWN_ATTACKS.map(({ payload }) => payload) });

    expect(findUnsafeUserLinks(container)).toEqual(expect.arrayContaining([expect.stringContaining(issue)]));
  });

  it("report nothing for plain text and links that follow the rules", () => {
    const { container } = setup({
      renderer: "html",
      content: [
        "<p>Plain text with a /deployments path</p>",
        '<a href="https://example.com/" target="_blank" rel="ugc nofollow noopener noreferrer">example.com</a>',
        '<a href="https://console.akash.network/templates" target="_blank" rel="ugc nofollow noopener noreferrer">console.akash.network</a>',
        '<a href="mailto:team@example.com" target="_blank" rel="noreferrer ugc noopener nofollow">Write to us</a>',
        '<img src="https://img.shields.io/badge/akash-ready-red" alt="Akash ready">'
      ]
    });

    expect(findActiveContent(container)).toEqual([]);
    expect(findUnsafeUserLinks(container)).toEqual([]);
  });

  function setup(input: { renderer: "html" | "markdown"; content: string[] }) {
    if (input.renderer === "html") {
      const inertDocument = new DOMParser().parseFromString(input.content.map(content => `<div>${content}</div>`).join(""), "text/html");
      return { container: inertDocument.body };
    }

    return render(
      <>
        {input.content.map((content, index) => (
          <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        ))}
      </>
    );
  }
});
