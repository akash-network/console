import React from "react";
import { describe, expect, it } from "vitest";

import type { GalleryEntry } from "@src/components/templates/communityGallery/galleryEntries";
import { COMMUNITY_CARD_NOTE, GalleryEntryCard, galleryEntryHref } from "./GalleryEntryCard";

import { render, screen, within } from "@testing-library/react";
import { buildGalleryEntry } from "@tests/seeders/communityTemplate";

const GiB = 1024 ** 3;
const HOSTILE_MARKUP = '<img src=x onerror="alert(1)"><script>alert(2)</script>';

describe(GalleryEntryCard.name, () => {
  it("links a community template to its template page", () => {
    setup({ entry: { origin: "console", id: "0b6f6f0c-6d0f-4b53-9d5c-0c7d2d6f0001", title: "Open WebUI" } });

    expect(screen.getByRole("link", { name: /Open WebUI/ })).toHaveAttribute("href", "/template/0b6f6f0c-6d0f-4b53-9d5c-0c7d2d6f0001");
  });

  it("links an awesome-akash template to its gallery page", () => {
    setup({ entry: { origin: "awesome-akash", id: "akash-network-awesome-akash-llama", title: "Llama" } });

    expect(screen.getByRole("link", { name: /Llama/ })).toHaveAttribute("href", "/templates/akash-network-awesome-akash-llama");
  });

  it("shows the title, the summary and the publisher", () => {
    setup({
      entry: { title: "Open WebUI", summary: "Private chat on your own GPU", publisher: { name: "Lambda Garage", handle: "lambda-garage", verified: false } }
    });

    expect(screen.getByRole("heading", { name: "Open WebUI" })).toBeInTheDocument();
    expect(screen.getByText("Private chat on your own GPU")).toBeInTheDocument();
    expect(screen.getByText("Lambda Garage")).toBeInTheDocument();
    expect(screen.getByText("LG")).toBeInTheDocument();
  });

  it("links the publisher to its page, beside the template link and not inside it", () => {
    const { container } = setup({ entry: { title: "Open WebUI", publisher: { name: "Lambda Garage", handle: "lambda-garage", verified: false } } });

    expect(screen.getByRole("link", { name: "Lambda Garage" })).toHaveAttribute("href", "/template-publishers/lambda-garage");
    expect(screen.getByRole("link", { name: "Open WebUI" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(container.querySelector("a a")).toBeNull();
  });

  it("names the publisher without a link on its own page", () => {
    setup({ entry: { title: "Open WebUI", publisher: { name: "Lambda Garage", handle: "lambda-garage", verified: false } }, linksPublisher: false });

    expect(screen.getByText("Lambda Garage")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("names Akash without a link on an awesome-akash template, which has no publisher page", () => {
    setup({ entry: { origin: "awesome-akash", isOfficial: true, publisher: null, title: "Llama" } });

    expect(screen.getByText("Akash Network")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("marks a verified publisher and leaves an unverified one unmarked", () => {
    const { unmount } = setup({ entry: { publisher: { name: "Lambda Garage", handle: "lambda-garage", verified: true } } });
    expect(screen.getByRole("img", { name: "Verified by Akash" })).toBeInTheDocument();
    unmount();

    setup({ entry: { publisher: { name: "Lambda Garage", handle: "lambda-garage", verified: false } } });
    expect(screen.queryByRole("img", { name: "Verified by Akash" })).not.toBeInTheDocument();
  });

  it("says a community template is not reviewed by Akash", () => {
    setup({ entry: { isOfficial: false } });

    expect(screen.getByText(COMMUNITY_CARD_NOTE)).toBeInTheDocument();
    expect(screen.queryByText("Official")).not.toBeInTheDocument();
  });

  it("shows Official instead of the community note on a template staff promoted", () => {
    setup({ entry: { isOfficial: true, scores: { popular: null, trending: null, isTrending: true } } });

    expect(screen.getByText("Official")).toBeInTheDocument();
    expect(screen.queryByText(COMMUNITY_CARD_NOTE)).not.toBeInTheDocument();
    expect(screen.queryByText("Trending")).not.toBeInTheDocument();
  });

  it("names Akash Network and awesome-akash on an awesome-akash template", () => {
    setup({ entry: { origin: "awesome-akash", isOfficial: true, publisher: null, versionCount: null } });

    expect(screen.getByText("Akash Network")).toBeInTheDocument();
    expect(screen.getByText("· awesome-akash")).toBeInTheDocument();
    expect(screen.queryByText("Versions:", { exact: false })).not.toBeInTheDocument();
  });

  it("does not credit awesome-akash on a community template", () => {
    setup({ entry: { origin: "console" } });

    expect(screen.queryByText("· awesome-akash")).not.toBeInTheDocument();
  });

  it("marks a trending community template", () => {
    setup({ entry: { scores: { popular: null, trending: 4, isTrending: true } } });

    expect(screen.getByText("Trending")).toBeInTheDocument();
  });

  it("shows no badge on a community template that is not trending", () => {
    setup({ entry: { scores: { popular: 5, trending: 4, isTrending: false } } });

    expect(screen.queryByText("Trending")).not.toBeInTheDocument();
  });

  it("shows versions, forks and deploys, shortening large numbers", () => {
    setup({ entry: { versionCount: 4, usage: { deploys: 1284, stillUpAfter24h: null, forks: 37 } } });

    const usage = screen.getByRole("list", { name: "Usage" });
    expect(within(usage).getByTitle("Versions")).toHaveTextContent("Versions: 4");
    expect(within(usage).getByTitle("Forks")).toHaveTextContent("Forks: 37");
    expect(within(usage).getByTitle("Deploys")).toHaveTextContent("Deploys: 1.3K");
  });

  it("shows nothing rather than zero for forks and deploys nobody made", () => {
    setup({ entry: { versionCount: 1, usage: { deploys: 0, stillUpAfter24h: null, forks: 0 } } });

    const usage = screen.getByRole("list", { name: "Usage" });
    expect(within(usage).queryByTitle("Forks")).not.toBeInTheDocument();
    expect(within(usage).queryByTitle("Deploys")).not.toBeInTheDocument();
    expect(within(usage).getByTitle("Versions")).toBeInTheDocument();
  });

  it("shows a single fork and a single deploy", () => {
    setup({ entry: { usage: { deploys: 1, stillUpAfter24h: null, forks: 1 } } });

    expect(screen.getByTitle("Forks")).toHaveTextContent("Forks: 1");
    expect(screen.getByTitle("Deploys")).toHaveTextContent("Deploys: 1");
  });

  it("shows the share still up after 24 h, rounded, and hides it without enough data", () => {
    const { unmount } = setup({ entry: { usage: { deploys: 10, stillUpAfter24h: 0.936, forks: 0 } } });
    expect(screen.getByText("· 94% still up after 24 h")).toBeInTheDocument();
    unmount();

    setup({ entry: { usage: { deploys: 10, stillUpAfter24h: null, forks: 0 } } });
    expect(screen.queryByText(/still up after 24 h/)).not.toBeInTheDocument();
  });

  it("shows a share of zero still up, which is data", () => {
    setup({ entry: { usage: { deploys: 10, stillUpAfter24h: 0, forks: 0 } } });

    expect(screen.getByText("· 0% still up after 24 h")).toBeInTheDocument();
  });

  it("summarises the hardware the template asks for", () => {
    setup({ entry: { resources: { cpu: 8, memoryBytes: 48 * GiB, storageBytes: 40 * GiB, gpu: { units: 1, models: ["a100"] } } } });

    const hardware = screen.getByRole("list", { name: "Hardware" });
    expect(within(hardware).getByTitle("GPU")).toHaveTextContent("1× A100");
    expect(within(hardware).getByTitle("vCPU")).toHaveTextContent("8");
    expect(within(hardware).getByTitle("Memory")).toHaveTextContent("48 GiB");
  });

  it("shows no hardware when the template's SDL could not be read", () => {
    setup({ entry: { resources: null } });

    expect(screen.queryByRole("list", { name: "Hardware" })).not.toBeInTheDocument();
  });

  it("renders markup in the title, the summary and the publisher name as text", () => {
    const { container } = setup({
      entry: { title: HOSTILE_MARKUP, summary: HOSTILE_MARKUP, publisher: { name: HOSTILE_MARKUP, handle: "x", verified: false } }
    });

    expect(screen.getAllByText(HOSTILE_MARKUP)).toHaveLength(3);
    expect(container.querySelector("img, script")).toBeNull();
  });

  describe(galleryEntryHref.name, () => {
    it("sends each source to its own page", () => {
      expect(galleryEntryHref({ origin: "console", id: "abc" })).toBe("/template/abc");
      expect(galleryEntryHref({ origin: "awesome-akash", id: "abc" })).toBe("/templates/abc");
    });
  });

  function setup(input: { entry: Partial<GalleryEntry>; linksPublisher?: boolean }) {
    return render(<GalleryEntryCard entry={buildGalleryEntry(input.entry)} linksPublisher={input.linksPublisher} />);
  }
});
