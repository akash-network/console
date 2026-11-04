import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";

import Markdown from "./Markdown";

import { render } from "@testing-library/react";

const ACTIVE_HTML_README = [
  "# Template",
  "",
  '<script>window.readmeScriptRan = "script body";</script>',
  "",
  '<iframe src="https://example.com/embedded">iframe fallback</iframe>',
  "",
  '<iframe srcdoc="<p>framed document</p>"></iframe>',
  "",
  "<style>body { display: none; }</style>",
  "",
  '<form action="/api/auth/logout" method="post"><input type="text" name="email"><button type="submit">Continue</button></form>',
  "",
  '<meta http-equiv="refresh" content="0;url=https://example.com/elsewhere">',
  "",
  '<base href="https://example.com/">',
  "",
  '<object data="https://example.com/plugin.swf"></object>',
  "",
  '<embed src="https://example.com/plugin.swf">',
  "",
  "<noscript>noscript fallback</noscript>",
  "",
  "<template><p>template content</p></template>",
  "",
  '<svg><a xlink:href="javascript:alert(1)"><text>vector link</text></a></svg>',
  "",
  '<img src="https://example.com/logo.png" alt="Logo" onerror="alert(1)" onload="alert(2)">',
  "",
  '<a href="javascript:alert(1)" onclick="alert(2)">script link</a> <a href="https://akash.network" onmouseover="alert(3)">Akash</a>',
  "",
  '<img src="javascript:alert(1)" alt="Script image">',
  "",
  '<video controls src="javascript:alert(1)" poster="javascript:alert(2)"></video>',
  "",
  '<details open ontoggle="alert(1)"><summary>More</summary>Details body</details>',
  "",
  '<div style="position: fixed; inset: 0; z-index: 9999">Styled overlay</div>'
].join("\n");

const PASSIVE_README = [
  "# Template",
  "",
  "Some **bold**, _italic_, ~~struck~~ and `inline code`, with a [link](https://akash.network).",
  "",
  '<div align="center"><img src="https://example.com/logo.png" alt="Logo" width="200" height="100"></div>',
  "",
  '<p align="center"><a href="https://akash.network" target="_blank"><img src="https://example.com/badge.svg" alt="Badge"></a></p>',
  "",
  '<picture><source media="(prefers-color-scheme: dark)" srcset="https://example.com/dark.png"><img src="https://example.com/light.png" alt="Theme logo"></picture>',
  "",
  '<video controls src="https://example.com/demo.mp4" poster="https://example.com/poster.png" title="Demo"></video>',
  "",
  "| Column | Value |",
  "| :--- | ---: |",
  "| cpu | 1 |",
  "",
  '<table><tr><th>Name</th><td rowspan="2">Value</td></tr><tr><th>Other</th></tr></table>',
  "",
  "<details>",
  "<summary>Show more</summary>",
  "",
  "Hidden **content**.",
  "",
  "</details>",
  "",
  "- [x] done",
  "- [ ] open",
  "",
  "1. first",
  "2. second",
  "",
  "> quoted",
  "",
  "```js",
  "const port = 8080;",
  "```",
  "",
  "Text with <b>b</b>, <u>u</u>, <s>s</s>, <sub>sub</sub>, <sup>sup</sup> and <kbd>Ctrl</kbd>.<br>",
  "",
  "<hr>"
].join("\n");

describe("Markdown", () => {
  it.each(["script", "iframe", "style", "form", "button", "meta", "base", "object", "embed", "noscript", "template", "svg"])(
    "drops %s elements from README HTML",
    tagName => {
      const { container } = setup({ markdown: ACTIVE_HTML_README, hasHtml: true });

      expect(container.querySelector(tagName)).toBeNull();
    }
  );

  it("drops the script, CSS and fallback text of dropped elements", () => {
    const { container } = setup({ markdown: ACTIVE_HTML_README, hasHtml: true });

    expect(container.textContent).not.toMatch(/script body|display: none|iframe fallback|framed document|noscript fallback|template content/);
  });

  it("keeps the text of the passive parts of README HTML", () => {
    const { container } = setup({ markdown: ACTIVE_HTML_README, hasHtml: true });

    expect(container.textContent).toContain("Continue");
    expect(container.textContent).toContain("Details body");
    expect(container.textContent).toContain("Styled overlay");
    expect(container.querySelector('img[src="https://example.com/logo.png"]')).not.toBeNull();
    expect(container.querySelector('a[href="https://akash.network"]')).not.toBeNull();
  });

  it("leaves a form field only as a disabled checkbox", () => {
    const { container } = setup({ markdown: ACTIVE_HTML_README, hasHtml: true });

    expect(Array.from(container.querySelectorAll("input")).map(input => [input.type, input.disabled])).toEqual([["checkbox", true]]);
  });

  it("drops event handler attributes", () => {
    const { container } = setup({ markdown: ACTIVE_HTML_README, hasHtml: true });

    expect(listAttributes(container).filter(attribute => attribute.name.startsWith("on"))).toEqual([]);
  });

  it("drops javascript: URLs", () => {
    const { container } = setup({ markdown: ACTIVE_HTML_README, hasHtml: true });

    expect(listAttributes(container).filter(attribute => /javascript:/i.test(attribute.value))).toEqual([]);
  });

  it("drops inline styles", () => {
    const { container } = setup({ markdown: ACTIVE_HTML_README, hasHtml: true });

    expect(container.querySelector("[style]")).toBeNull();
  });

  it("renders formatting, images, tables, details, task lists and media in README HTML as it did before sanitizing", () => {
    const { container } = setup({ markdown: PASSIVE_README, hasHtml: true });

    expect(container.firstElementChild?.innerHTML).toBe(renderWithoutSanitizing(PASSIVE_README));
  });

  it("highlights fenced code in README HTML", () => {
    const { container } = setup({ markdown: PASSIVE_README, hasHtml: true });

    expect(container.querySelector("pre code.hljs.language-js .hljs-keyword")?.textContent).toBe("const");
  });

  it("keeps the language of a code element written as HTML and drops its other classes", () => {
    const { container } = setup({ markdown: '<pre><code class="language-bash shadow-lg">echo hi</code></pre>', hasHtml: true });

    expect(container.querySelector("code")?.className).toBe("hljs language-bash");
  });

  it("highlights fenced code in Markdown without HTML", () => {
    const { container } = setup({ markdown: "```js\nconst port = 8080;\n```" });

    expect(container.querySelector("pre code.hljs.language-js .hljs-keyword")?.textContent).toBe("const");
  });

  it("does not render HTML in Markdown without HTML", () => {
    const { container } = setup({ markdown: '<img src="https://example.com/logo.png" alt="Logo">' });

    expect(container.querySelector("img")).toBeNull();
  });

  function listAttributes(container: HTMLElement) {
    return Array.from(container.querySelectorAll("*")).flatMap(element => Array.from(element.attributes));
  }

  function renderWithoutSanitizing(markdown: string) {
    const { container } = render(
      <ReactMarkdown linkTarget="_blank" remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }], rehypeRaw as any]}>
        {markdown}
      </ReactMarkdown>
    );

    return container.innerHTML;
  }

  function setup(input: { markdown: string; hasHtml?: boolean }) {
    return render(<Markdown hasHtml={input.hasHtml}>{input.markdown}</Markdown>);
  }
});
