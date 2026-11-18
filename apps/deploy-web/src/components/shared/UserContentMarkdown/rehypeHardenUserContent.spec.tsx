import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";

import { LEAVES_CONSOLE_MARK, rehypeHardenUserContent, USER_CONTENT_LINK_REL } from "./rehypeHardenUserContent";

import { render, screen } from "@testing-library/react";

type HastNode = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: HastNode[] };

const LOADABLE_IMAGE = "https://raw.githubusercontent.com/akash-network/console/main/logo.png";

describe(rehypeHardenUserContent.name, () => {
  describe("links", () => {
    it("opens an http link in a new tab, marked as user content", () => {
      setup({ markdown: "[Docs](https://example.com/docs)" });

      const link = screen.getByRole("link", { name: "Docs" });
      expect(link).toHaveAttribute("href", "https://example.com/docs");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "ugc nofollow noopener noreferrer");
    });

    it("keeps nothing else the author put on a link", () => {
      setup({ markdown: '[Docs](https://example.com/docs "https://console.akash.network")' });

      expect(screen.getByRole("link", { name: "Docs" }).getAttributeNames().sort()).toEqual(["href", "rel", "target"]);
    });

    it("marks a link as leaving Console without changing how it is announced", () => {
      setup({ markdown: "[Docs](https://example.com/docs)" });

      const link = screen.getByRole("link", { name: "Docs" });
      expect(link.textContent).toBe(`Docs${LEAVES_CONSOLE_MARK}`);
      expect(link.querySelector("span[aria-hidden='true']")?.textContent).toBe(LEAVES_CONSOLE_MARK);
    });

    it("links an email address", () => {
      setup({ markdown: "[Write to us](mailto:team@example.com)" });

      expect(screen.getByRole("link", { name: "Write to us" })).toHaveAttribute("href", "mailto:team@example.com");
    });

    it("links to the address the browser reads rather than the one written", () => {
      setup({ markdown: "[Docs](HTTPS://EXAMPLE.com/a/../docs)" });

      expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "https://example.com/docs");
    });

    it.each([
      ["a script", "[Docs](javascript:alert(1))"],
      ["a data document", "[Docs](data:text/html,hello)"],
      ["a vbscript", "[Docs](vbscript:msgbox(1))"],
      ["a file", "[Docs](file:///etc/passwd)"],
      ["a Console route", "[Docs](/api/auth/logout)"],
      ["a place on the page", "[Docs](#usage)"],
      ["an address without a scheme", "[Docs](//example.com/docs)"],
      ["an address with a user name", "[Docs](https://console.akash.network@example.com/)"],
      ["an address with a password", "[Docs](https://:secret@example.com/)"]
    ])("shows a link to %s as its text alone", (_, markdown) => {
      const { container } = setup({ markdown });

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(container.querySelector("a")).toBeNull();
      expect(container.textContent).toBe("Docs");
    });

    it.each([
      ["a full address", "https://console.akash.network/billing"],
      ["a host", "console.akash.network"],
      ["a host among other words", "Open console.akash.network now"],
      ["a host split by zero-width characters", "console.akash\u200b.net\u00adwork"],
      ["a host written with full-width dots", "console\uff0eakash\uff0enetwork"],
      ["a host written with ideographic full stops", "console\u3002akash\uff61network"],
      ["its own host next to another one", "attacker.example or console.akash.network"],
      ["an address that has no host name", "http://10.0.0.1/admin"],
      ["an IPv4 address", "10.0.0.1"],
      ["an IPv4 address and a port", "127.0.0.1:8080"],
      ["an IPv6 address", "2001:db8::1"],
      ["the IPv6 loopback address", "the router at ::1"],
      ["a local host and a port", "localhost:3000"],
      ["a host written with middle dots", "console\u00b7akash\u00b7network"],
      ["a host written with hyphenation points and dot operators", "console\u2027akash\u22c5network"],
      ["a host written with a katakana middle dot", "akash\u30fbnetwork"]
    ])("spells out where a link labelled with %s really goes", (_, label) => {
      const { container } = setup({ markdown: `[${label}](https://attacker.example/billing)` });

      const link = screen.getByRole("link", { name: "https://attacker.example/billing" });
      expect(link).toHaveAttribute("href", "https://attacker.example/billing");
      expect(link).toHaveAttribute("rel", "ugc nofollow noopener noreferrer");
      expect(link).toHaveAttribute("target", "_blank");
      expect(screen.getAllByRole("link")).toHaveLength(1);
      expect(container.textContent).toBe(`${label} (https://attacker.example/billing${LEAVES_CONSOLE_MARK})`);
    });

    it.each([
      ["the host it goes to", "example.com"],
      ["the host it goes to in another case", "Example.COM"],
      ["the host it goes to with www", "www.example.com"],
      ["the address it goes to", "https://example.com/docs"],
      ["a page on the host it goes to", "Read example.com/docs/intro first"],
      ["the host it goes to split by a zero-width character", "exam\u200bple.com"],
      ["words that name no address", "the docs for v1.2.3"],
      ["a version with four parts", "release v1.2.3.4"],
      ["a version that ends a longer number", "build 2024.1.2.3.4-rc1"],
      ["code that uses double colons", "tokio::spawn"],
      ["a time of day", "open from 9:30"]
    ])("keeps a link labelled with %s", (_, label) => {
      const { container } = setup({ markdown: `[${label}](https://example.com/docs)` });

      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", "https://example.com/docs");
      expect(container.textContent).toBe(`${label}${LEAVES_CONSOLE_MARK}`);
    });

    it("keeps a link whose host carries www when its label leaves it out", () => {
      setup({ markdown: "[example.com](https://www.example.com/)" });

      expect(screen.getByRole("link", { name: "example.com" })).toHaveAttribute("href", "https://www.example.com/");
    });

    it("treats www as part of a host only at its start", () => {
      const { container } = setup({ markdown: "[awww.example.com](https://aexample.com/)" });

      expect(container.textContent).toBe(`awww.example.com (https://aexample.com/${LEAVES_CONSOLE_MARK})`);
    });

    it("keeps a link labelled with the address it goes to when formatting splits the label", () => {
      const { container } = setup({ markdown: "[https://**example.com**/docs](https://example.com/)" });

      expect(screen.getByRole("link")).toHaveAttribute("href", "https://example.com/");
      expect(container.textContent).toBe(`https://example.com/docs${LEAVES_CONSOLE_MARK}`);
    });

    it("keeps an email link labelled with its address when the host is written in another case", () => {
      const { container } = setup({ markdown: "[team@example.com](mailto:team@EXAMPLE.com)" });

      expect(container.textContent).toBe(`team@example.com${LEAVES_CONSOLE_MARK}`);
    });

    it("keeps a link labelled with its host written with an ideographic full stop", () => {
      const { container } = setup({ markdown: "[docs\u3002example.com](https://docs.example.com/)" });

      expect(container.textContent).toBe(`docs\u3002example.com${LEAVES_CONSOLE_MARK}`);
    });

    it.each([
      ["an IPv4 address", "10.0.0.1", "http://10.0.0.1/admin"],
      ["a local host", "localhost:3000", "http://localhost:3000/admin"],
      ["a host written with middle dots", "docs\u00b7example\u00b7com", "https://docs.example.com/admin"]
    ])("keeps a link labelled with the destination it goes to, written as %s", (_, label, href) => {
      const { container } = setup({ markdown: `[${label}](${href})` });

      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
      expect(container.textContent).toBe(`${label}${LEAVES_CONSOLE_MARK}`);
    });

    it("spells out an internationalized host, which can imitate any other", () => {
      const { container } = setup({ markdown: "[Console](https://c\u043ensole.akash.network/)" });

      expect(screen.getByRole("link", { name: "https://xn--cnsole-wqf.akash.network/" })).toBeInTheDocument();
      expect(container.textContent).toBe(`Console (https://xn--cnsole-wqf.akash.network/${LEAVES_CONSOLE_MARK})`);
    });

    it("spells out an internationalized host labelled with its own look-alike name", () => {
      const { container } = setup({ markdown: "[c\u043ensole.akash.network](https://c\u043ensole.akash.network/)" });

      expect(container.textContent).toBe(`c\u043ensole.akash.network (https://xn--cnsole-wqf.akash.network/${LEAVES_CONSOLE_MARK})`);
    });

    it("shows a link once when its label already is its address", () => {
      const { container } = setup({ markdown: "<https://xn--cnsole-wqf.akash.network/>" });

      expect(screen.getAllByRole("link")).toHaveLength(1);
      expect(container.textContent).toBe(`https://xn--cnsole-wqf.akash.network/${LEAVES_CONSOLE_MARK}`);
    });

    it.each([
      ["its address", "team@example.com"],
      ["its address with a dotted mailbox", "first.last@example.com"],
      ["its address in another case", "First.Last@EXAMPLE.com"],
      ["its host", "example.com"]
    ])("keeps an email link labelled with %s", (_, label) => {
      const { container } = setup({ markdown: `[${label}](mailto:first.last@example.com)` });

      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", "mailto:first.last@example.com");
      expect(container.textContent).toBe(`${label}${LEAVES_CONSOLE_MARK}`);
    });

    it("spells out where an email link labelled with another address really goes", () => {
      const { container } = setup({ markdown: "[support@akash.network](mailto:support@attacker.example)" });

      expect(container.textContent).toBe(`support@akash.network (mailto:support@attacker.example${LEAVES_CONSOLE_MARK})`);
    });

    it("does not take a mailbox name for a host on a web link", () => {
      const { container } = setup({ markdown: "[console.akash.network@attacker.example](https://attacker.example/)" });

      expect(container.textContent).toBe(`console.akash.network@attacker.example (https://attacker.example/${LEAVES_CONSOLE_MARK})`);
    });

    it("reads a label across its formatting", () => {
      const { container } = setup({ markdown: "[**console**.akash.*network*](https://attacker.example/)" });

      expect(container.textContent).toBe(`console.akash.network (https://attacker.example/${LEAVES_CONSOLE_MARK})`);
      expect(container.querySelector("strong")?.closest("a")).toBeNull();
    });

    it("keeps the formatting of a label it links", () => {
      setup({ markdown: "[the **docs**](https://example.com/)" });

      expect(screen.getByRole("link", { name: "the docs" }).querySelector("strong")?.textContent).toBe("docs");
    });

    it("never nests a link in a link", () => {
      const nested: HastNode = element("a", { href: "https://attacker.example/" }, [{ type: "text", value: "inner" }]);
      const tree = transform([element("a", { href: "https://example.com/" }, [{ type: "text", value: "outer " }, nested])]);

      expect(tree.children).toEqual([
        element("a", { href: "https://example.com/", target: "_blank", rel: USER_CONTENT_LINK_REL }, [
          { type: "text", value: "outer " },
          { type: "text", value: "inner" },
          element("span", { ariaHidden: "true" }, [{ type: "text", value: LEAVES_CONSOLE_MARK }])
        ])
      ]);
    });

    it("gives every link a rel list of its own", () => {
      const tree = transform([element("a", { href: "https://example.com/" }, [])]);

      expect(tree.children?.[0].properties?.rel).toEqual(USER_CONTENT_LINK_REL);
      expect(tree.children?.[0].properties?.rel).not.toBe(USER_CONTENT_LINK_REL);
    });

    it.each([undefined, 42, ["https://example.com/"]])("unlinks a link whose address is %j rather than text", href => {
      const tree = transform([element("a", { href }, [{ type: "text", value: "Docs" }])]);

      expect(tree.children).toEqual([{ type: "text", value: "Docs" }]);
    });

    it("unlinks a link that has no properties or children", () => {
      expect(transform([{ type: "element", tagName: "a" }]).children).toEqual([]);
    });
  });

  describe("images", () => {
    it("loads an image from a listed source without sending where it is shown", () => {
      setup({ markdown: `![Akash logo](${LOADABLE_IMAGE} "hover text")` });

      const image = screen.getByRole("img", { name: "Akash logo" });
      expect(image).toHaveAttribute("src", LOADABLE_IMAGE);
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
      expect(image.getAttributeNames().sort()).toEqual(["alt", "loading", "referrerpolicy", "src"]);
    });

    it("shows an image from any other host as a link labelled with its alt text", () => {
      const { container } = setup({ markdown: "![Architecture diagram](https://attacker.example/diagram.png)" });

      const link = screen.getByRole("link", { name: "Architecture diagram" });
      expect(link).toHaveAttribute("href", "https://attacker.example/diagram.png");
      expect(link).toHaveAttribute("rel", "ugc nofollow noopener noreferrer");
      expect(container.querySelector("img")).toBeNull();
    });

    it("labels an image it does not load with its address when it has no alt text", () => {
      const { container } = setup({ markdown: "![](https://attacker.example/diagram.png)" });

      expect(screen.getByRole("link", { name: "https://attacker.example/diagram.png" })).toBeInTheDocument();
      expect(container.querySelector("img")).toBeNull();
    });

    it("spells out the address of an image it does not load when its alt text names another host", () => {
      const { container } = setup({ markdown: "![console.akash.network](https://attacker.example/diagram.png)" });

      expect(container.textContent).toBe(`console.akash.network (https://attacker.example/diagram.png${LEAVES_CONSOLE_MARK})`);
    });

    it.each([
      ["a Console route", "/api/auth/logout"],
      ["a data address", "data:image/png;base64,AAAA"],
      ["a script address", "javascript:alert(1)"]
    ])("shows only the alt text of an image at %s", (_, src) => {
      const { container } = setup({ markdown: `![Diagram](${src})` });

      expect(container.textContent).toBe("Diagram");
      expect(container.querySelector("img, a")).toBeNull();
    });

    it("shows nothing for an image it can neither load nor link that has no alt text", () => {
      const { container } = setup({ markdown: "Before ![](/api/auth/logout) after" });

      expect(container.textContent).toBe("Before  after");
      expect(container.querySelector("img, a")).toBeNull();
    });

    it("never makes an image a link", () => {
      const { container } = setup({ markdown: `[![Deploy](${LOADABLE_IMAGE}) on Akash](https://attacker.example/phish)` });

      expect(screen.getByRole("img", { name: "Deploy" })).toBeInTheDocument();
      expect(container.querySelector("a")).toBeNull();
      expect(container.textContent).toBe(" on Akash");
    });

    it("never makes an image a link when formatting wraps it", () => {
      const { container } = setup({ markdown: `[**![Deploy](${LOADABLE_IMAGE})**](https://attacker.example/phish)` });

      expect(screen.getByRole("img", { name: "Deploy" })).toBeInTheDocument();
      expect(container.querySelector("a")).toBeNull();
    });

    it("keeps a link around an image it does not load, labelled with the alt text", () => {
      const { container } = setup({ markdown: "[![Build status](https://ci.attacker.example/badge.svg)](https://example.com/builds)" });

      expect(screen.getByRole("link", { name: "Build status" })).toHaveAttribute("href", "https://example.com/builds");
      expect(screen.getAllByRole("link")).toHaveLength(1);
      expect(container.querySelector("img")).toBeNull();
    });

    it("drops an image without alt text that it does not load from inside a link", () => {
      const { container } = setup({ markdown: "[![](https://ci.attacker.example/badge.svg) builds](https://example.com/builds)" });

      expect(container.textContent).toBe(` builds${LEAVES_CONSOLE_MARK}`);
      expect(container.querySelector("img")).toBeNull();
    });

    it("replaces a loadable image with one that carries only what it needs", () => {
      const tree = transform([
        element("img", { src: LOADABLE_IMAGE, alt: "Logo", title: "hover", onError: "alert(1)", srcSet: ["https://attacker.example/2x.png 2x"] })
      ]);

      expect(tree.children).toEqual([element("img", { src: LOADABLE_IMAGE, alt: "Logo", loading: "lazy", referrerPolicy: "no-referrer" }, [])]);
    });

    it("shows an image that has no properties as nothing", () => {
      expect(transform([{ type: "element", tagName: "img" }]).children).toEqual([]);
    });

    it("takes the reading direction overrides out of alt text", () => {
      setup({ markdown: `![Akash\u202e logo](${LOADABLE_IMAGE})` });

      expect(screen.getByRole("img")).toHaveAttribute("alt", "Akash logo");
    });
  });

  describe("text", () => {
    it("takes the reading direction overrides out of text, code and raw HTML", () => {
      const overrides = "\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069";
      const { container } = setup({ markdown: `plain${overrides} text\n\n\`co${overrides}de\`\n\n<b>ra${overrides}w</b>` });

      expect(container.textContent).toBe("plain text\ncode\n<b>raw</b>");
    });

    it("leaves every other character where it is", () => {
      const { container } = setup({ markdown: "café שלום \u200e\u{1f468}\u200d\u{1f469}\u200d\u{1f467} \u2029\u202f\u2065\u206a" });

      expect(container.textContent).toBe("café שלום \u200e\u{1f468}\u200d\u{1f469}\u200d\u{1f467} \u2029\u202f\u2065\u206a");
    });

    it("keeps elements that are neither links nor images, with what they hold", () => {
      const tree = transform([element("ul", { className: ["contains-task-list"] }, [element("li", {}, [{ type: "text", value: "one" }])]), element("hr", {})]);

      expect(tree.children).toEqual([
        element("ul", { className: ["contains-task-list"] }, [element("li", {}, [{ type: "text", value: "one" }])]),
        element("hr", {}, [])
      ]);
    });

    it("hardens a tree that has no children", () => {
      expect(transform(undefined).children).toEqual([]);
    });
  });

  function element(tagName: string, properties: Record<string, unknown>, children?: HastNode[]): HastNode {
    return { type: "element", tagName, properties, ...(children && { children }) };
  }

  function transform(children: HastNode[] | undefined) {
    const tree: HastNode = { type: "root", children };
    rehypeHardenUserContent()(tree);
    return tree;
  }

  function setup(input: { markdown: string }) {
    return render(
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHardenUserContent]}>
        {input.markdown}
      </ReactMarkdown>
    );
  }
});
