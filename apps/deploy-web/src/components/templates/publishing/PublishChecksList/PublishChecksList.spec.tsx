import { describe, expect, it, vi } from "vitest";

import type { TemplatePublishCheck } from "@src/types/marketplace-template";
import type { PublishCheckFix } from "../publishReadiness";
import { PublishChecksList, PublishStatusMark } from "./PublishChecksList";

import { render, screen, within } from "@testing-library/react";

const MARKUP = '<img src=x onerror="alert(1)">';

describe(PublishChecksList.name, () => {
  it("lists every check with its name and result", () => {
    setup({
      checks: [
        { key: "sdl_valid", status: "passed", issues: [] },
        { key: "fixed_tags", status: "failed", issues: [{ message: "webui uses open-webui:latest. Pick a version tag.", service: "webui" }] }
      ]
    });

    const rows = within(screen.getByRole("list", { name: "Publish checks" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("PassedSDL is valid");
    expect(rows[1]).toHaveTextContent("FailedImages use a fixed tagwebui uses open-webui:latest. Pick a version tag.");
  });

  it("shows every issue of a failed check", () => {
    setup({
      checks: [
        {
          key: "no_secrets",
          status: "failed",
          issues: [{ message: "web: HF_TOKEN looks like a key." }, { message: "db: PASSWORD looks like a password." }]
        }
      ]
    });

    expect(screen.getByText("web: HF_TOKEN looks like a key.")).toBeInTheDocument();
    expect(screen.getByText("db: PASSWORD looks like a password.")).toBeInTheDocument();
  });

  it("says a check failed when the API gave no reason", () => {
    setup({ checks: [{ key: "images_allowed", status: "failed", issues: [] }] });

    expect(screen.getByText("This check didn't pass.")).toBeInTheDocument();
  });

  it("keeps the issues of a passed check to itself", () => {
    setup({ checks: [{ key: "sdl_valid", status: "passed", issues: [{ message: "A note nobody needs" }] }] });

    expect(screen.queryByText("A note nobody needs")).not.toBeInTheDocument();
    expect(screen.queryByText("This check didn't pass.")).not.toBeInTheDocument();
  });

  it("names a check this build does not know", () => {
    setup({ checks: [{ key: "text_within_limits", status: "failed", issues: [{ message: "The summary is too long." }] }] });

    expect(screen.getByText("Text within limits")).toBeInTheDocument();
    expect(screen.getByText("The summary is too long.")).toBeInTheDocument();
  });

  it("shows text written by the publisher as inert text", () => {
    const { container } = setup({ checks: [{ key: "fixed_tags", status: "failed", issues: [{ message: `${MARKUP} has no tag` }] }] });

    expect(screen.getByText(`${MARKUP} has no tag`)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("offers each fix of a failed check", () => {
    const { renderFix } = setup({
      checks: [
        { key: "sdl_valid", status: "passed", issues: [] },
        {
          key: "name_not_reserved",
          status: "failed",
          issues: [
            { message: "Titles can't contain Official.", field: "title" },
            { message: "Publisher names can't contain Akash.", field: "publisher_name" }
          ]
        }
      ],
      hasFixes: true
    });

    expect(renderFix.mock.calls.map(([fix]) => fix)).toEqual(["rename", "rename-organization"]);
    expect(screen.getByRole("button", { name: "Fix: rename" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fix: rename-organization" })).toBeInTheDocument();
  });

  it("offers no fix where the list is only a report", () => {
    setup({ checks: [{ key: "fixed_tags", status: "failed", issues: [{ message: "No tag" }] }] });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("passes its class on to the list", () => {
    setup({ checks: [], className: "opacity-60" });

    expect(screen.getByRole("list", { name: "Publish checks" })).toHaveClass("opacity-60");
  });

  function setup(input: {
    checks: { key: string; status: "passed" | "failed"; issues: TemplatePublishCheck["issues"] }[];
    hasFixes?: boolean;
    className?: string;
  }) {
    const renderFix = vi.fn((fix: PublishCheckFix) => <button type="button">Fix: {fix}</button>);
    const result = render(
      <PublishChecksList checks={input.checks as TemplatePublishCheck[]} renderFix={input.hasFixes ? renderFix : undefined} className={input.className} />
    );

    return { ...result, renderFix };
  }
});

describe(PublishStatusMark.name, () => {
  it.each([
    [true, "Met"],
    [false, "Not met"]
  ])("reads %s as %s", (isMet, label) => {
    render(<PublishStatusMark isMet={isMet} metLabel="Met" unmetLabel="Not met" />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
