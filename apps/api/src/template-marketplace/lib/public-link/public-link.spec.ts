import { describe, expect, it } from "vitest";

import { MAX_PUBLIC_LINK_LENGTH, parsePublicLink } from "./public-link";

describe(parsePublicLink.name, () => {
  it.each([
    ["https://lambdagarage.dev", "https://lambdagarage.dev/"],
    ["https://github.com/lambda-garage?tab=repositories#top", "https://github.com/lambda-garage?tab=repositories#top"],
    ["HTTPS://Docs.Example-Site.CO.UK/a b", "https://docs.example-site.co.uk/a%20b"],
    ["https://a1.b2.io:443/", "https://a1.b2.io/"],
    ["https://lambdagarage.dev\\@evil.example.org", "https://lambdagarage.dev/@evil.example.org"],
    ["https://bücher.de/", "https://xn--bcher-kva.de/"],
    ["https://пример.рф/", "https://xn--e1afmkfd.xn--p1ai/"]
  ])("answers %s as the parser reads it", (value, href) => {
    expect(parsePublicLink(value)).toEqual({ href });
  });

  it.each([
    ["not a url", "The link is not a URL"],
    ["lambdagarage.dev", "The link is not a URL"],
    ["http://lambdagarage.dev", "The link must start with https://"],
    ["javascript:alert(1)", "The link must start with https://"],
    ["data:text/html,<script>alert(1)</script>", "The link must start with https://"],
    ["ftp://lambdagarage.dev", "The link must start with https://"],
    ["https://sam@lambdagarage.dev", "The link cannot carry a username or a password"],
    ["https://:secret@lambdagarage.dev", "The link cannot carry a username or a password"],
    ["https://lambdagarage.dev:8443/", "The link cannot name a port"],
    ["https://127.0.0.1/", "The link must name a website, not an address"],
    ["https://8.8.8.8/", "The link must name a website, not an address"],
    ["https://0x7f.1/", "The link must name a website, not an address"],
    ["https://2130706433/", "The link must name a website, not an address"],
    ["https://[::1]/", "The link must name a website, not an address"],
    ["https://[2606:4700:4700::1111]/", "The link must name a website, not an address"],
    ["https://localhost/", "The link must name a public website"],
    ["https://intranet/", "The link must name a public website"],
    ["https://dev/", "The link must name a public website"],
    ["https://lambdagarage.dev./", "The link must name a public website"],
    ["https://printer.local/", "The link must name a public website"],
    ["https://db.internal/", "The link must name a public website"],
    ["https://metadata.google.internal/", "The link must name a public website"],
    ["https://app.localhost/", "The link must name a public website"],
    ["https://site.test/", "The link must name a public website"],
    ["https://hidden.onion/", "The link must name a public website"],
    ["https://1.0.0.in-addr.arpa/", "The link must name a public website"],
    ["https://lambda_garage.dev/", "The link must name a public website"],
    ["https://-lambda.dev/", "The link must name a public website"],
    ["https://lambda-.dev/", "The link must name a public website"],
    ["https://lambdagarage.d/", "The link must name a public website"],
    ["https://lambdagarage.d3v/", "The link must name a public website"]
  ])("refuses %s", (value, issue) => {
    expect(parsePublicLink(value)).toEqual({ issue });
  });

  it("refuses a link longer than the limit, as written or once the parser has encoded it", () => {
    const issue = `The link is longer than ${MAX_PUBLIC_LINK_LENGTH} characters`;
    const prefix = "https://lambdagarage.dev/";
    const atLimit = `${prefix}${"a".repeat(MAX_PUBLIC_LINK_LENGTH - prefix.length)}`;

    expect(parsePublicLink(atLimit)).toEqual({ href: atLimit });
    expect(parsePublicLink(`${atLimit}a`)).toEqual({ issue });
    expect(parsePublicLink(`${prefix}${" ".repeat(MAX_PUBLIC_LINK_LENGTH - prefix.length - 1)}a`)).toEqual({ issue });
    expect(parsePublicLink(`not a url ${"a".repeat(MAX_PUBLIC_LINK_LENGTH)}`)).toEqual({ issue });
  });
});
