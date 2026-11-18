import { describe, expect, it, vi } from "vitest";

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

  function setup(input: { liveVersion?: number; checkResults?: TemplateCheckResults | null }) {
    const onKeepEditing = vi.fn();
    const onViewVersions = vi.fn();

    render(
      <FailedChecksDialog
        version={{ version: 5, checkResults: input.checkResults === undefined ? CHECK_RESULTS : input.checkResults }}
        liveVersion={"liveVersion" in input ? input.liveVersion : 4}
        onKeepEditing={onKeepEditing}
        onViewVersions={onViewVersions}
      />
    );

    return { onKeepEditing, onViewVersions };
  }
});
