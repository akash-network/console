import { describe, expect, it, vi } from "vitest";

import type { PublishFixLinks } from "@src/components/templates/publishing/publishReadiness";
import type { TemplateCheckResults } from "@src/types/marketplace-template";
import { FailedChecksDialog } from "./FailedChecksDialog";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const CHECK_RESULTS: TemplateCheckResults = {
  ranAt: "2026-11-18T18:00:00.000Z",
  checks: [
    { key: "sdl_valid", status: "passed", issues: [] },
    { key: "fixed_tags", status: "failed", issues: [{ message: "webui uses open-webui:latest. Pick a version tag." }] },
    { key: "no_secrets", status: "failed", issues: [{ message: "web: HF_TOKEN looks like a key." }] }
  ]
};

const FIX_LINKS: PublishFixLinks = {
  rename: "/template/tpl-9?tab=settings",
  "rename-organization": "/organization",
  "edit-configuration": "/new-deployment/configure?templateMode=edit&userTemplateId=tpl-9",
  "edit-readme": "/template/tpl-9?tab=readme",
  "edit-summary": "/template/tpl-9?tab=settings"
};

describe(FailedChecksDialog.name, () => {
  it("says the version is saved but not live, and which version stays live", () => {
    setup({});

    expect(screen.getByRole("heading", { name: "v5 is saved, but it isn't live" })).toBeInTheDocument();
    expect(
      screen.getByText("It didn't pass the publish checks of a public template, so people keep deploying v4. Fix what's listed here and save again.")
    ).toBeInTheDocument();
  });

  it("names no live version when the template has none", () => {
    setup({ liveVersion: undefined });

    expect(screen.getByText("It didn't pass the publish checks of a public template. Fix what's listed here and save again.")).toBeInTheDocument();
  });

  it("lists only the checks that failed, with their reasons", () => {
    setup({});

    const rows = within(screen.getByRole("list", { name: "Publish checks" })).getAllByRole("listitem");
    expect(rows.map(row => row.textContent)).toEqual([
      "FailedImages use a fixed tagwebui uses open-webui:latest. Pick a version tag.",
      "FailedNo secrets in valuesweb: HF_TOKEN looks like a key."
    ]);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit configuration" })).not.toBeInTheDocument();
  });

  it("offers the fixes made outside Configure next to the check they answer", async () => {
    const { onFollowFix } = setup({
      checkResults: {
        ranAt: CHECK_RESULTS.ranAt,
        checks: [
          {
            key: "text_within_limits",
            status: "failed",
            issues: [
              { message: "The title is 81 characters long, and a public template allows 80.", field: "title" },
              { message: "The summary is 230 characters long, and a public template allows 200.", field: "summary" },
              { message: "The README is 50,400 characters long, and a public template allows 50,000.", field: "readme" }
            ]
          },
          { key: "name_not_reserved", status: "failed", issues: [{ message: "The organization name uses a reserved word.", field: "publisher_name" }] }
        ]
      }
    });

    const [textLimits, reservedName] = within(screen.getByRole("list", { name: "Publish checks" })).getAllByRole("listitem");
    expect(textLimits).toHaveTextContent("Title, summary and README within their length limits");
    expect(
      within(textLimits)
        .getAllByRole("button")
        .map(button => button.textContent)
    ).toEqual(["Rename", "Settings", "Edit README"]);

    await userEvent.click(within(textLimits).getByRole("button", { name: "Rename" }));
    await userEvent.click(within(textLimits).getByRole("button", { name: "Settings" }));
    await userEvent.click(within(textLimits).getByRole("button", { name: "Edit README" }));
    await userEvent.click(within(reservedName).getByRole("button", { name: "Organization settings" }));

    expect(onFollowFix.mock.calls).toEqual([
      ["/template/tpl-9?tab=settings"],
      ["/template/tpl-9?tab=settings"],
      ["/template/tpl-9?tab=readme"],
      ["/organization"]
    ]);
  });

  it("offers no fix whose place it was not given", () => {
    setup({
      fixLinks: {},
      checkResults: {
        ranAt: CHECK_RESULTS.ranAt,
        checks: [{ key: "name_not_reserved", status: "failed", issues: [{ message: "The organization name uses a reserved word.", field: "publisher_name" }] }]
      }
    });

    expect(screen.queryByRole("button", { name: "Organization settings" })).not.toBeInTheDocument();
  });

  it.each([
    ["has no check results", null],
    ["lists no failed check", { ranAt: CHECK_RESULTS.ranAt, checks: [CHECK_RESULTS.checks[0]] }]
  ])("points at the Versions tab when the answer %s", (_, checkResults) => {
    setup({ checkResults });

    expect(screen.getByText("The Versions tab of the template shows what failed.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Publish checks" })).not.toBeInTheDocument();
  });

  it("goes back to editing from the button, the close button and Escape", async () => {
    const { onKeepEditing, onViewVersions } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.keyboard("{Escape}");

    expect(onKeepEditing).toHaveBeenCalledTimes(3);
    expect(onViewVersions).not.toHaveBeenCalled();
  });

  it("leaves for the versions on request", async () => {
    const { onKeepEditing, onViewVersions } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "View versions" }));

    expect(onViewVersions).toHaveBeenCalledTimes(1);
    expect(onKeepEditing).not.toHaveBeenCalled();
  });

  function setup(input: { liveVersion?: number; checkResults?: TemplateCheckResults | null; fixLinks?: PublishFixLinks }) {
    const onFollowFix = vi.fn();
    const onKeepEditing = vi.fn();
    const onViewVersions = vi.fn();

    render(
      <FailedChecksDialog
        version={{ version: 5, checkResults: input.checkResults === undefined ? CHECK_RESULTS : input.checkResults }}
        liveVersion={"liveVersion" in input ? input.liveVersion : 4}
        fixLinks={input.fixLinks ?? FIX_LINKS}
        onFollowFix={onFollowFix}
        onKeepEditing={onKeepEditing}
        onViewVersions={onViewVersions}
      />
    );

    return { onFollowFix, onKeepEditing, onViewVersions };
  }
});
