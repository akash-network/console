import React from "react";
import { describe, expect, it } from "vitest";

import type { TemplatePublisherCardProps } from "./TemplatePublisherCard";
import { TemplatePublisherCard } from "./TemplatePublisherCard";

import { render, screen, within } from "@testing-library/react";

describe(TemplatePublisherCard.name, () => {
  it("shows the publisher's name, templates, deploys and how long it has been on Console", () => {
    setup({ publisher: { name: "Lambda Garage", memberSince: "2025-07-11T12:00:00.000Z", counts: { templates: 7, deploys: 18400 } } });

    const card = within(screen.getByRole("complementary", { name: "Publisher" }));
    expect(card.getByText("Lambda Garage")).toBeInTheDocument();
    expect(card.getByText("7 templates · 18.4K deploys")).toBeInTheDocument();
    expect(card.getByText("Member since Jul 2025")).toBeInTheDocument();
  });

  it("counts a single template and a single deploy in the singular", () => {
    setup({ publisher: { counts: { templates: 1, deploys: 1 } } });

    expect(screen.getByText("1 template · 1 deploy")).toBeInTheDocument();
  });

  it("leaves the deploys out before the first one", () => {
    setup({ publisher: { counts: { templates: 2, deploys: 0 } } });

    expect(screen.getByText("2 templates")).toBeInTheDocument();
    expect(screen.queryByText(/deploy/)).not.toBeInTheDocument();
  });

  it("leaves Member since out while the API does not know it", () => {
    setup({ publisher: { memberSince: null } });

    expect(screen.queryByText(/Member since/)).not.toBeInTheDocument();
  });

  it("marks a verified publisher and leaves an unverified one unmarked", () => {
    const { unmount } = setup({ publisher: { verified: true } });
    expect(screen.getByRole("img", { name: "Verified by Akash" })).toBeInTheDocument();
    unmount();

    setup({ publisher: { verified: false } });
    expect(screen.queryByRole("img", { name: "Verified by Akash" })).not.toBeInTheDocument();
  });

  it("shows when the template was published and which version is current", () => {
    setup({ publishedAt: "2026-10-30T12:00:00.000Z", currentVersion: 4 });

    expect(screen.getByText("Published").nextElementSibling).toHaveTextContent("Oct 30, 2026");
    expect(screen.getByText("Current version").nextElementSibling).toHaveTextContent("v4");
  });

  it("leaves the publish date out of a template that never went through the publish checks", () => {
    setup({ publishedAt: null, currentVersion: 2 });

    expect(screen.queryByText("Published")).not.toBeInTheDocument();
    expect(screen.getByText("Current version")).toBeInTheDocument();
  });

  it("leaves the current version out of a template that has none", () => {
    setup({ publishedAt: "2026-10-30T12:00:00.000Z", currentVersion: undefined });

    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.queryByText("Current version")).not.toBeInTheDocument();
  });

  it("shows no facts list with neither a publish date nor a current version", () => {
    const { container } = setup({ publishedAt: null, currentVersion: undefined });

    expect(container.querySelector("dl")).toBeNull();
  });

  it("links to no publisher page, which does not exist yet", () => {
    setup({ publisher: { handle: "lambda-garage" } });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders markup in the publisher name as text", () => {
    const { container } = setup({ publisher: { name: "<img src=x onerror=alert(1)>" } });

    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  function setup(input: { publisher?: Partial<TemplatePublisherCardProps["publisher"]>; publishedAt?: string | null; currentVersion?: number }) {
    const publisher: TemplatePublisherCardProps["publisher"] = {
      name: "Northwind Labs",
      slug: "northwind-labs",
      type: "team",
      handle: "northwind-labs",
      verified: false,
      memberSince: null,
      counts: { templates: 1, deploys: 0 },
      ...input.publisher
    };

    return render(
      <TemplatePublisherCard
        publisher={publisher}
        publishedAt={input.publishedAt === undefined ? null : input.publishedAt}
        currentVersion={input.currentVersion}
      />
    );
  }
});
