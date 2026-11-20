import { describe, expect, it } from "vitest";

import type { PublisherProfileDraft } from "./publisherProfileRules";
import {
  findPublisherProfileIssues,
  hasPublisherProfileIssues,
  MAX_PUBLISHER_BIO_LENGTH,
  MAX_PUBLISHER_LINK_LABEL_LENGTH,
  MAX_PUBLISHER_LINK_URL_LENGTH,
  MAX_PUBLISHER_LINKS,
  toPublisherProfileChange,
  toPublisherProfileDraft
} from "./publisherProfileRules";

describe("publisherProfileRules", () => {
  it("keeps the limits the API enforces", () => {
    expect({ MAX_PUBLISHER_BIO_LENGTH, MAX_PUBLISHER_LINKS, MAX_PUBLISHER_LINK_URL_LENGTH, MAX_PUBLISHER_LINK_LABEL_LENGTH }).toEqual({
      MAX_PUBLISHER_BIO_LENGTH: 300,
      MAX_PUBLISHER_LINKS: 3,
      MAX_PUBLISHER_LINK_URL_LENGTH: 200,
      MAX_PUBLISHER_LINK_LABEL_LENGTH: 40
    });
  });

  describe(toPublisherProfileDraft.name, () => {
    it("turns a profile into editable text", () => {
      expect(
        toPublisherProfileDraft({
          bio: "We build GPU stacks.",
          links: [
            { url: "https://lambdagarage.dev/", label: null },
            { url: "https://github.com/lambda-garage", label: "GitHub" }
          ]
        })
      ).toEqual({
        bio: "We build GPU stacks.",
        links: [
          { url: "https://lambdagarage.dev/", label: "" },
          { url: "https://github.com/lambda-garage", label: "GitHub" }
        ]
      });
    });

    it("starts from an empty bio when there is none", () => {
      expect(toPublisherProfileDraft({ bio: null, links: [] })).toEqual({ bio: "", links: [] });
    });
  });

  describe(findPublisherProfileIssues.name, () => {
    it("finds nothing wrong with an empty profile", () => {
      const issues = findPublisherProfileIssues({ bio: "", links: [] });

      expect(issues).toEqual({ bio: undefined, links: [] });
      expect(hasPublisherProfileIssues(issues)).toBe(false);
    });

    it("accepts a bio of exactly the limit and counts it without the spaces around it", () => {
      expect(findPublisherProfileIssues({ bio: `  ${"a".repeat(300)}\n`, links: [] }).bio).toBeUndefined();
    });

    it("refuses a bio one character over the limit", () => {
      const issues = findPublisherProfileIssues({ bio: "a".repeat(301), links: [] });

      expect(issues.bio).toBe("The bio is longer than 300 characters");
      expect(hasPublisherProfileIssues(issues)).toBe(true);
    });

    it.each([
      ["https://lambdagarage.dev"],
      ["  https://lambdagarage.dev/docs?x=1#top  "],
      ["HTTPS://LambdaGarage.dev"],
      ["https://lambdagarage.dev:443/"],
      ["https://sub.domain.lambdagarage.co.uk/"],
      ["https://xn--pple-43d.com/"],
      ["https://example.xn--p1ai/"],
      [`https://lambdagarage.dev/${"a".repeat(200 - "https://lambdagarage.dev/".length)}`]
    ])("accepts %s", url => {
      const issues = findPublisherProfileIssues({ bio: "", links: [{ url, label: "" }] });

      expect(issues.links).toEqual([{ url: undefined, label: undefined }]);
      expect(hasPublisherProfileIssues(issues)).toBe(false);
    });

    it.each([
      ["lambdagarage.dev", "The link is not a URL"],
      ["https://", "The link is not a URL"],
      ["http://lambdagarage.dev/", "The link must start with https://"],
      ["javascript:alert(1)", "The link must start with https://"],
      ["ftp://lambdagarage.dev/", "The link must start with https://"],
      ["https://user@lambdagarage.dev/", "The link cannot carry a username or a password"],
      ["https://:secret@lambdagarage.dev/", "The link cannot carry a username or a password"],
      ["https://lambdagarage.dev:8443/", "The link cannot name a port"],
      ["https://127.0.0.1/", "The link must name a website, not an address"],
      ["https://2130706433/", "The link must name a website, not an address"],
      ["https://[::1]/", "The link must name a website, not an address"],
      ["https://localhost/", "The link must name a public website"],
      ["https://intranet.corp/", "The link must name a public website"],
      ["https://printer.local/", "The link must name a public website"],
      ["https://hidden.onion/", "The link must name a public website"],
      ["https://lambdagarage.d/", "The link must name a public website"],
      ["https://lambdagarage.d3v/", "The link must name a public website"],
      ["https://lambda_garage.dev/", "The link must name a public website"],
      ["https://-lambdagarage.dev/", "The link must name a public website"],
      [`https://lambdagarage.dev/${"a".repeat(201 - "https://lambdagarage.dev/".length)}`, "The link is longer than 200 characters"],
      [`https://lambdagarage.dev/${"é".repeat(60)}`, "The link is longer than 200 characters"]
    ])("refuses %s", (url, issue) => {
      const issues = findPublisherProfileIssues({ bio: "", links: [{ url, label: "" }] });

      expect(issues.links).toEqual([{ url: issue, label: undefined }]);
      expect(hasPublisherProfileIssues(issues)).toBe(true);
    });

    it("asks for the address of a link that only has a label", () => {
      expect(findPublisherProfileIssues({ bio: "", links: [{ url: "  ", label: "Docs" }] }).links).toEqual([
        { url: "Add the link's address, or clear its label", label: undefined }
      ]);
    });

    it("leaves a row with neither an address nor a label alone", () => {
      const issues = findPublisherProfileIssues({ bio: "", links: [{ url: " ", label: " " }] });

      expect(issues.links).toEqual([{ url: undefined, label: undefined }]);
      expect(hasPublisherProfileIssues(issues)).toBe(false);
    });

    it("accepts a label of exactly the limit, counted without the spaces around it, and refuses one over", () => {
      const atLimit = findPublisherProfileIssues({ bio: "", links: [{ url: "https://lambdagarage.dev", label: ` ${"a".repeat(40)} ` }] });
      const overLimit = findPublisherProfileIssues({ bio: "", links: [{ url: "https://lambdagarage.dev", label: "a".repeat(41) }] });

      expect(atLimit.links).toEqual([{ url: undefined, label: undefined }]);
      expect(overLimit.links).toEqual([{ url: undefined, label: "The label is longer than 40 characters" }]);
      expect(hasPublisherProfileIssues(overLimit)).toBe(true);
    });

    it("reports each link on its own row", () => {
      const issues = findPublisherProfileIssues({
        bio: "",
        links: [
          { url: "https://lambdagarage.dev", label: "" },
          { url: "http://lambdagarage.dev", label: "" }
        ]
      });

      expect(issues.links).toEqual([
        { url: undefined, label: undefined },
        { url: "The link must start with https://", label: undefined }
      ]);
    });
  });

  describe(toPublisherProfileChange.name, () => {
    it("sends the bio and the links trimmed, with an empty label as none", () => {
      expect(toPublisherProfileChange(draft({ bio: "  We build GPU stacks.\n", links: [{ url: " https://lambdagarage.dev ", label: "  " }] }))).toEqual({
        bio: "We build GPU stacks.",
        links: [{ url: "https://lambdagarage.dev", label: null }]
      });
    });

    it("keeps a label, trimmed", () => {
      expect(toPublisherProfileChange(draft({ links: [{ url: "https://github.com/lambda-garage", label: " GitHub " }] })).links).toEqual([
        { url: "https://github.com/lambda-garage", label: "GitHub" }
      ]);
    });

    it("clears a blank bio and drops empty rows", () => {
      expect(
        toPublisherProfileChange(
          draft({
            bio: "   ",
            links: [
              { url: "", label: " " },
              { url: "https://lambdagarage.dev", label: "" }
            ]
          })
        )
      ).toEqual({ bio: null, links: [{ url: "https://lambdagarage.dev", label: null }] });
    });

    it("sends an empty list when every link was removed", () => {
      expect(toPublisherProfileChange(draft({ links: [] }))).toEqual({ bio: null, links: [] });
    });
  });

  function draft(overrides: Partial<PublisherProfileDraft>): PublisherProfileDraft {
    return { bio: "", links: [], ...overrides };
  }
});
