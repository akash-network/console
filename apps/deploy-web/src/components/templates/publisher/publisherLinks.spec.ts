import { describe, expect, it } from "vitest";

import { readPublisherLink } from "./publisherLinks";

describe(readPublisherLink.name, () => {
  it("shows an unlabelled link by its host and path, without the trailing slash", () => {
    expect(readPublisherLink({ url: "https://lambdagarage.dev/", label: null })).toEqual({
      href: "https://lambdagarage.dev/",
      text: "lambdagarage.dev",
      host: null
    });
    expect(readPublisherLink({ url: "https://github.com/lambda-garage/", label: null })).toEqual({
      href: "https://github.com/lambda-garage/",
      text: "github.com/lambda-garage",
      host: null
    });
  });

  it("shows the real host beside a label, so the label cannot pass for another site", () => {
    expect(readPublisherLink({ url: "https://evil.example.org/login", label: "github.com/akash-network" })).toEqual({
      href: "https://evil.example.org/login",
      text: "github.com/akash-network",
      host: "evil.example.org"
    });
  });

  it("treats a blank label as no label", () => {
    expect(readPublisherLink({ url: "https://lambdagarage.dev/docs", label: "   " })).toEqual({
      href: "https://lambdagarage.dev/docs",
      text: "lambdagarage.dev/docs",
      host: null
    });
  });

  it("links an http address too", () => {
    expect(readPublisherLink({ url: "http://lambdagarage.dev/", label: null }).href).toBe("http://lambdagarage.dev/");
  });

  it("links the address as the URL parser reads it", () => {
    expect(readPublisherLink({ url: "HTTPS://LambdaGarage.dev", label: null })).toEqual({
      href: "https://lambdagarage.dev/",
      text: "lambdagarage.dev",
      host: null
    });
  });

  it("shows a lookalike host in its encoded form", () => {
    expect(readPublisherLink({ url: "https://аpple.com/", label: "Apple" }).host).toBe("xn--pple-43d.com");
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)", "file:///etc/passwd", "ftp://lambdagarage.dev/"])(
    "never links %s",
    url => {
      expect(readPublisherLink({ url, label: null })).toEqual({ href: null, text: url, host: null });
    }
  );

  it("shows an address it will not link next to its label, as text", () => {
    expect(readPublisherLink({ url: "javascript:alert(1)", label: "Docs" })).toEqual({ href: null, text: "Docs", host: "javascript:alert(1)" });
  });

  it("never links something that is not an address", () => {
    expect(readPublisherLink({ url: "not a link", label: null })).toEqual({ href: null, text: "not a link", host: null });
    expect(readPublisherLink({ url: "", label: null })).toEqual({ href: null, text: "", host: null });
  });
});
