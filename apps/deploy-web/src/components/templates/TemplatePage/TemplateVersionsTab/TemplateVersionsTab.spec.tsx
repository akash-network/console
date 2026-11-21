import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TemplateVersionDetail, TemplateVersionSummary } from "@src/types/marketplace-template";
import { DEPENDENCIES, TemplateVersionsTab } from "./TemplateVersionsTab";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildTemplateVersion, buildTemplateVersionSummary } from "@tests/seeders/userTemplate";
import { MockComponents } from "@tests/unit/mocks";

type VersionQuery = ReturnType<typeof DEPENDENCIES.useTemplateVersion>;

const TEMPLATE_ID = "tpl-webui";
const sdlOf = (image: string, env: string[]) =>
  `version: "2.0"\nservices:\n  web:\n    image: ${image}\n    env:\n${env.map(line => `      - ${line}`).join("\n")}\n`;

const V1 = buildTemplateVersionSummary({
  templateId: TEMPLATE_ID,
  version: 1,
  createdBy: { username: "ana" },
  createdAt: "2026-10-01T12:00:00.000Z",
  changes: ["first_version"],
  deploys: 1284
});
const V2 = buildTemplateVersionSummary({
  templateId: TEMPLATE_ID,
  version: 2,
  createdBy: { username: "ben" },
  createdAt: "2026-10-15T12:00:00.000Z",
  changes: ["image_changed", "env_changed"],
  deploys: 12
});
const V3 = buildTemplateVersionSummary({
  templateId: TEMPLATE_ID,
  version: 3,
  createdBy: null,
  createdAt: "2026-11-02T12:00:00.000Z",
  changes: null,
  deploys: 0
});
const VERSION_DETAILS: Record<number, TemplateVersionDetail> = {
  1: buildTemplateVersion({ templateId: TEMPLATE_ID, version: 1, sdl: sdlOf("nginx:1.25", ["MODE=dev"]) }),
  2: buildTemplateVersion({ templateId: TEMPLATE_ID, version: 2, sdl: sdlOf("nginx:1.26", ["MODE=dev", "TOKEN=abc"]) }),
  3: buildTemplateVersion({ templateId: TEMPLATE_ID, version: 3, sdl: sdlOf("nginx:1.27", ["MODE=prod", "TOKEN=abc"]) })
};

describe(TemplateVersionsTab.name, () => {
  it("lists versions newest first with status, author, date, changes and deploys", () => {
    setup({ versions: [V3, V2, V1], currentVersion: 3, canEdit: false });

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map(row => within(row).getAllByRole("cell")[0].textContent)).toEqual(["v3", "v2", "v1"]);

    const [v3, v2, v1] = rows.map(row =>
      within(row)
        .getAllByRole("cell")
        .map(cell => cell.textContent)
    );
    expect(v1).toEqual(["v1", "Published", "ana", "Oct 1, 2026", "First version", "1,284", "View"]);
    expect(v2).toEqual(["v2", "Published", "ben", "Oct 15, 2026", "Image changedEnv changed", "12", "View"]);
    expect(v3).toEqual(["v3", "PublishedCurrent", "–", "Nov 2, 2026", "–", "0", "View"]);
    expect(screen.getByRole("columnheader", { name: "Version" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Created by" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Changes" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Deploys" })).toBeInTheDocument();
  });

  it("introduces the history and where new versions come from", () => {
    setup({ versions: [V1], currentVersion: 1, canEdit: false });

    expect(screen.getByRole("heading", { name: "Version history" })).toBeInTheDocument();
    expect(screen.getByText("Published versions never change. Deployments and forks stay on the version they started from.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "New versions come from Edit configuration → Save new version. On a public template, a new version goes live once its checks pass, and a risky change to a popular or Official template waits for staff review first."
      )
    ).toBeInTheDocument();
  });

  it("shows why a version failed its publish checks, and which version is current", () => {
    const failed = buildTemplateVersionSummary({
      templateId: TEMPLATE_ID,
      version: 4,
      status: "failed_checks",
      checkResults: {
        ranAt: "2026-11-10T12:00:00.000Z",
        checks: [
          { key: "sdl_valid", status: "passed", issues: [{ message: "A note on a check that passed" }] },
          {
            key: "no_secrets",
            status: "failed",
            issues: [{ message: "web: CIVITAI_TOKEN looks like an API key." }, { message: "db: PASSWORD has a default." }]
          },
          { key: "images_allowed", status: "failed", issues: [] }
        ]
      }
    });
    setup({ versions: [failed, V3], currentVersion: 3, canEdit: true });

    const [failedRow, currentRow] = screen.getAllByRole("row").slice(1);
    expect(within(failedRow).getByText("Failed checks")).toHaveClass("text-red-600");
    expect(within(failedRow).queryByText("Current")).not.toBeInTheDocument();
    expect(
      within(within(failedRow).getByRole("list", { name: "Why v4 failed" }))
        .getAllByRole("listitem")
        .map(item => item.textContent)
    ).toEqual(["web: CIVITAI_TOKEN looks like an API key.", "db: PASSWORD has a default.", "Images allowed"]);
    expect(within(currentRow).getByText("Published")).toHaveClass("text-green-700");
    expect(within(currentRow).getByText("Current")).toBeInTheDocument();
    expect(within(currentRow).queryByRole("list", { name: /^Why/ })).not.toBeInTheDocument();
  });

  it("gives no reasons for a failed version whose check results the viewer may not see", () => {
    const failed = buildTemplateVersionSummary({ version: 2, status: "failed_checks", checkResults: null });
    setup({ versions: [failed], currentVersion: undefined, canEdit: false });

    expect(screen.getByText("Failed checks")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Why v2 failed" })).not.toBeInTheDocument();
  });

  it("keeps the stored check results of a published version out of its row", () => {
    const live = buildTemplateVersionSummary({
      version: 2,
      status: "live",
      checkResults: { ranAt: "2026-11-10T12:00:00.000Z", checks: [{ key: "fixed_tags", status: "failed", issues: [{ message: "An old finding" }] }] }
    });
    setup({ versions: [live], currentVersion: 2, canEdit: true });

    expect(screen.queryByText("An old finding")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Why v2 failed" })).not.toBeInTheDocument();
  });

  it("shows a publisher's text in a failure reason as inert text", () => {
    const markup = '<img src=x onerror="alert(1)"> has no tag';
    const failed = buildTemplateVersionSummary({
      version: 2,
      status: "failed_checks",
      checkResults: { ranAt: "2026-11-10T12:00:00.000Z", checks: [{ key: "fixed_tags", status: "failed", issues: [{ message: markup }] }] }
    });
    const { container } = setup({ versions: [failed], currentVersion: undefined, canEdit: false });

    expect(screen.getByText(markup)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("marks a version held for staff review", () => {
    setup({ versions: [buildTemplateVersionSummary({ version: 5, status: "held" })], currentVersion: undefined, canEdit: false });

    expect(screen.getByText("Held for staff review")).toHaveClass("text-amber-700");
  });

  it("shows why a held version waits for review while the current one stays marked", () => {
    const held = buildTemplateVersionSummary({
      version: 5,
      status: "held",
      holdReasons: [
        { kind: "official_template", message: "Akash staff review every new version of an Official template." },
        { kind: "global_port_added", message: "web newly opens port 8188 to the internet.", service: "web", port: 8188, protocol: "tcp" }
      ]
    });
    const published = buildTemplateVersionSummary({ version: 4, status: "live" });
    setup({ versions: [held, published], currentVersion: 4, canEdit: true });

    const [heldRow, publishedRow] = screen.getAllByRole("row").slice(1);
    const reasons = within(within(heldRow).getByRole("list", { name: "Why v5 waits for review" })).getAllByRole("listitem");
    expect(reasons.map(reason => reason.textContent)).toEqual([
      "Akash staff review every new version of an Official template.",
      "web newly opens port 8188 to the internet."
    ]);
    expect(reasons[0]).toHaveClass("text-amber-700");
    expect(within(heldRow).queryByText("Current")).not.toBeInTheDocument();
    expect(within(publishedRow).getByText("Current")).toBeInTheDocument();
    expect(within(publishedRow).queryByRole("list", { name: /waits for review/ })).not.toBeInTheDocument();
  });

  it("gives no reasons for a held version whose reasons the viewer may not read", () => {
    setup({ versions: [buildTemplateVersionSummary({ version: 5, status: "held", holdReasons: null })], currentVersion: undefined, canEdit: false });

    expect(screen.getByText("Held for staff review")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /waits for review/ })).not.toBeInTheDocument();
  });

  it("keeps the recorded hold reasons of a version staff already decided out of its row", () => {
    const holdReasons = [{ kind: "image_repository_changed" as const, message: "web now runs ghcr.io/acme/web:2.0." }];
    const approved = buildTemplateVersionSummary({ version: 3, status: "live", holdReasons, reviewedAt: "2026-11-06T15:00:00.000Z" });
    const rejected = buildTemplateVersionSummary({ version: 2, status: "rejected", holdReasons, reviewedAt: "2026-11-05T15:00:00.000Z" });
    setup({ versions: [approved, rejected], currentVersion: 3, canEdit: true });

    expect(screen.queryByRole("list", { name: /waits for review/ })).not.toBeInTheDocument();
    expect(screen.queryByText("web now runs ghcr.io/acme/web:2.0.")).not.toBeInTheDocument();
  });

  it("says above the history that the newest held version waits and which version stays current", () => {
    const held = buildTemplateVersionSummary({ version: 5, status: "held" });
    const olderHeld = buildTemplateVersionSummary({ version: 4, status: "held" });
    const published = buildTemplateVersionSummary({ version: 3, status: "live" });
    setup({ versions: [olderHeld, held, published], currentVersion: 3, canEdit: true });

    expect(screen.getByRole("status")).toHaveTextContent(
      "v5 is waiting for Akash staff review. v3 stays the current version until then. You get an email and a notice in Console when it is decided."
    );
  });

  it("says nobody deploys a held version of a template that has no current version", () => {
    setup({ versions: [buildTemplateVersionSummary({ version: 1, status: "held" })], currentVersion: undefined, canEdit: true });

    expect(screen.getByRole("status")).toHaveTextContent("v1 is waiting for Akash staff review. Nobody deploys it until then.");
  });

  it.each([
    ["no version is held", [buildTemplateVersionSummary({ version: 2, status: "live" }), buildTemplateVersionSummary({ version: 1, status: "rejected" })], 2],
    [
      "a newer version went live after the held one",
      [buildTemplateVersionSummary({ version: 3, status: "live" }), buildTemplateVersionSummary({ version: 2, status: "held" })],
      3
    ],
    ["the held version is the one marked current", [buildTemplateVersionSummary({ version: 2, status: "held" })], 2]
  ])("shows no waiting notice when %s", (_, versions, currentVersion) => {
    setup({ versions, currentVersion, canEdit: true });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows when staff rejected a version and the note they left", () => {
    const rejected = buildTemplateVersionSummary({
      version: 2,
      status: "rejected",
      reviewedAt: "2026-11-05T15:00:00.000Z",
      reviewNote: "  The new image is not the project's own.\nPublish it from the upstream repository.  "
    });
    setup({ versions: [rejected, buildTemplateVersionSummary({ version: 1, status: "live" })], currentVersion: 1, canEdit: true });

    const [rejectedRow, publishedRow] = screen.getAllByRole("row").slice(1);
    expect(within(rejectedRow).getByText("Reviewed on Nov 5, 2026")).toBeInTheDocument();
    expect(within(rejectedRow).getByLabelText("Staff note on v2").textContent).toBe(
      "The new image is not the project's own.\nPublish it from the upstream repository."
    );
    expect(within(rejectedRow).getByLabelText("Staff note on v2")).toHaveClass("whitespace-pre-line");
    expect(within(publishedRow).queryByText(/by Akash staff|Reviewed on/)).not.toBeInTheDocument();
  });

  it("shows a rejection without a date or without a note", () => {
    const undated = buildTemplateVersionSummary({ version: 3, status: "rejected", reviewedAt: null, reviewNote: "Not the upstream image." });
    const unexplained = buildTemplateVersionSummary({ version: 2, status: "rejected", reviewedAt: "2026-11-05T15:00:00.000Z", reviewNote: "   " });
    setup({ versions: [undated, unexplained], currentVersion: undefined, canEdit: true });

    const [undatedRow, unexplainedRow] = screen.getAllByRole("row").slice(1);
    expect(within(undatedRow).queryByText(/Reviewed on/)).not.toBeInTheDocument();
    expect(within(undatedRow).getByLabelText("Staff note on v3")).toHaveTextContent("Not the upstream image.");
    expect(within(unexplainedRow).getByText("Reviewed on Nov 5, 2026")).toBeInTheDocument();
    expect(within(unexplainedRow).queryByLabelText("Staff note on v2")).not.toBeInTheDocument();
  });

  it("says nothing about a review on a rejected version the viewer may not read the review of", () => {
    setup({ versions: [buildTemplateVersionSummary({ version: 2, status: "rejected" })], currentVersion: undefined, canEdit: false });

    expect(screen.getByText("Rejected by staff")).toBeInTheDocument();
    expect(screen.queryByText(/Reviewed on/)).not.toBeInTheDocument();
  });

  it("shows when staff approved a version that was held", () => {
    const approved = buildTemplateVersionSummary({ version: 2, status: "live", reviewedAt: "2026-11-06T15:00:00.000Z", reviewNote: "Checked the image." });
    setup({ versions: [approved], currentVersion: 2, canEdit: true });

    expect(screen.getByText("Approved by Akash staff on Nov 6, 2026")).toBeInTheDocument();
    expect(screen.getByLabelText("Staff note on v2")).toHaveTextContent("Checked the image.");
  });

  it("shows an approval that carries a note but no date", () => {
    const approved = buildTemplateVersionSummary({ version: 2, status: "live", reviewedAt: null, reviewNote: "Checked the image." });
    setup({ versions: [approved], currentVersion: 2, canEdit: true });

    expect(screen.getByText("Approved by Akash staff")).toBeInTheDocument();
  });

  it.each(["held", "failed_checks"] as const)("shows no review outcome on a %s version", status => {
    setup({
      versions: [buildTemplateVersionSummary({ version: 2, status, reviewedAt: "2026-11-06T15:00:00.000Z", reviewNote: "Left over" })],
      currentVersion: undefined,
      canEdit: true
    });

    expect(screen.queryByText(/by Akash staff|Reviewed on/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Staff note on v2")).not.toBeInTheDocument();
  });

  it("shows markup in a hold reason and in a staff note as text", () => {
    const markup = '<img src=x onerror="alert(1)"> [docs](javascript:alert(1)) <a href="https://evil.example">here</a>';
    const held = buildTemplateVersionSummary({ version: 3, status: "held", holdReasons: [{ kind: "image_repository_changed", message: markup }] });
    const rejected = buildTemplateVersionSummary({ version: 2, status: "rejected", reviewedAt: "2026-11-05T15:00:00.000Z", reviewNote: markup });
    const { container } = setup({ versions: [held, rejected], currentVersion: undefined, canEdit: false });

    expect(screen.getAllByText(markup)).toHaveLength(2);
    expect(container.querySelector("img, a")).toBeNull();
  });

  it("names every kind of change", () => {
    const everyChange = buildTemplateVersionSummary({
      version: 1,
      changes: [
        "first_version",
        "service_added",
        "service_removed",
        "image_changed",
        "image_tag_changed",
        "env_changed",
        "ports_changed",
        "resources_changed",
        "asked_value_added",
        "asked_value_removed",
        "asked_value_changed",
        "readme_changed"
      ]
    });
    setup({ versions: [everyChange], currentVersion: 1, canEdit: false });

    expect(screen.getAllByRole("listitem").map(item => item.textContent)).toEqual([
      "First version",
      "Service added",
      "Service removed",
      "Image changed",
      "Image tag changed",
      "Env changed",
      "Ports changed",
      "Resources changed",
      "Asked value added",
      "Asked value removed",
      "Asked value changed",
      "README changed"
    ]);
  });

  it("says when a version changed nothing", () => {
    setup({ versions: [buildTemplateVersionSummary({ version: 2, changes: [] })], currentVersion: 2, canEdit: false });

    expect(screen.getByText("No changes recorded")).toBeInTheDocument();
  });

  it("labels versions held for review or that failed checks, and marks only the current one", () => {
    const held = buildTemplateVersionSummary({ version: 3, status: "held" });
    const failed = buildTemplateVersionSummary({ version: 2, status: "failed_checks" });
    const published = buildTemplateVersionSummary({ version: 1, status: "live" });
    setup({ versions: [held, failed, published], currentVersion: 1, canEdit: false });

    const [heldRow, failedRow, publishedRow] = screen.getAllByRole("row").slice(1);
    expect(within(heldRow).getByText("Held for staff review")).toBeInTheDocument();
    expect(within(heldRow).queryByText("Current")).not.toBeInTheDocument();
    expect(within(failedRow).getByText("Failed checks")).toBeInTheDocument();
    expect(within(failedRow).queryByText("Current")).not.toBeInTheDocument();
    expect(within(publishedRow).getByText("Published")).toBeInTheDocument();
    expect(within(publishedRow).getByText("Current")).toBeInTheDocument();
  });

  it("labels a version staff rejected", () => {
    const rejected = buildTemplateVersionSummary({ version: 2, status: "rejected" });
    const published = buildTemplateVersionSummary({ version: 1, status: "live" });
    setup({ versions: [rejected, published], currentVersion: 1, canEdit: false });

    const [rejectedRow] = screen.getAllByRole("row").slice(1);
    expect(within(rejectedRow).getByText("Rejected by staff")).toBeInTheDocument();
    expect(within(rejectedRow).queryByText("Current")).not.toBeInTheDocument();
  });

  it("shows a non-editor only the current version", () => {
    const { useTemplateVersion } = setup({ versions: [V3], currentVersion: 3, canEdit: false });

    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(useTemplateVersion).not.toHaveBeenCalled();
  });

  it("selects the version a click on View names", async () => {
    const { onView } = setup({ versions: [V3, V2, V1], currentVersion: 3, canEdit: false });

    await userEvent.click(screen.getByRole("button", { name: "View v2" }));

    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenCalledWith(2);
  });

  it("marks the row of the version the page shows", () => {
    setup({ versions: [V3, V2, V1], currentVersion: 3, shownVersion: 2, canEdit: false });

    const [v3, v2, v1] = screen.getAllByRole("row").slice(1);
    expect(v2).toHaveAttribute("aria-current", "true");
    expect(v3).not.toHaveAttribute("aria-current");
    expect(v1).not.toHaveAttribute("aria-current");
  });

  it("shows editors what changed against the previous version", () => {
    const { useTemplateVersion } = setup({ versions: [V3, V2, V1], currentVersion: 3, shownVersion: 3, canEdit: true });

    expect(useTemplateVersion).toHaveBeenCalledWith(TEMPLATE_ID, 3);
    expect(useTemplateVersion).toHaveBeenCalledWith(TEMPLATE_ID, 2);
    const panel = screen.getByRole("complementary", { name: "What changed in v3" });
    expect(within(panel).getByRole("heading", { name: "What changed in v3" })).toBeInTheDocument();
    expect(within(panel).getByText("v2 → v3")).toBeInTheDocument();
    const image = within(panel).getByRole("region", { name: "web image" });
    expect(
      within(image)
        .getAllByRole("listitem")
        .map(line => line.textContent)
    ).toEqual(["-nginx:1.26", "+nginx:1.27"]);
    const env = within(panel).getByRole("region", { name: "web env" });
    expect(
      within(env)
        .getAllByRole("listitem")
        .map(line => line.textContent)
    ).toEqual(["-MODE=dev", "+MODE=prod"]);
  });

  it("follows the version the page shows", () => {
    const { useTemplateVersion } = setup({ versions: [V3, V2, V1], currentVersion: 3, shownVersion: 2, canEdit: true });

    expect(useTemplateVersion).toHaveBeenCalledWith(TEMPLATE_ID, 2);
    expect(useTemplateVersion).toHaveBeenCalledWith(TEMPLATE_ID, 1);
    expect(screen.getByText("v1 → v2")).toBeInTheDocument();
    const env = screen.getByRole("region", { name: "web env" });
    expect(
      within(env)
        .getAllByRole("listitem")
        .map(line => line.textContent)
    ).toEqual(["+TOKEN=abc"]);
  });

  it("shows everything of the first version as added", () => {
    const { useTemplateVersion } = setup({ versions: [V1], currentVersion: 1, shownVersion: 1, canEdit: true });

    expect(useTemplateVersion).toHaveBeenLastCalledWith(TEMPLATE_ID, undefined);
    expect(screen.getByText("What changed in v1", { selector: "h3" })).toBeInTheDocument();
    const image = screen.getByRole("region", { name: "web image" });
    expect(
      within(image)
        .getAllByRole("listitem")
        .map(line => line.textContent)
    ).toEqual(["+nginx:1.25"]);
  });

  it("shows SDL text as text, never as markup", () => {
    const hostile = buildTemplateVersion({ version: 1, sdl: sdlOf("<img src=x onerror=alert(1)>:1", ["A=<script>alert(1)</script>"]) });
    const { container } = setup({ versions: [V1], currentVersion: 1, shownVersion: 1, canEdit: true, details: { 1: hostile } });

    expect(screen.getByText("<img src=x onerror=alert(1)>:1")).toBeInTheDocument();
    expect(screen.getByText("A=<script>alert(1)</script>")).toBeInTheDocument();
    expect(container.querySelector("img, script:not([src])")).toBeNull();
  });

  it("says when a version changed no image or env line", () => {
    const same = buildTemplateVersion({ version: 2, sdl: VERSION_DETAILS[1].sdl });
    setup({ versions: [V2, V1], currentVersion: 2, shownVersion: 2, canEdit: true, details: { 1: VERSION_DETAILS[1], 2: same } });

    expect(screen.getByText("No image or env changes")).toBeInTheDocument();
  });

  it("says it could not compare a version whose SDL is unreadable", () => {
    const unreadable = buildTemplateVersion({ version: 2, sdl: "services: [unclosed" });
    setup({ versions: [V2, V1], currentVersion: 2, shownVersion: 2, canEdit: true, details: { 1: VERSION_DETAILS[1], 2: unreadable } });

    expect(screen.getByText("Couldn't compare these versions.")).toBeInTheDocument();
    expect(screen.queryByText("No image or env changes")).not.toBeInTheDocument();
  });

  it("waits while the versions load", () => {
    setup({ versions: [V3, V2, V1], currentVersion: 3, shownVersion: 3, canEdit: true, states: { 3: "loading", 2: "loading" } });

    expect(screen.getByRole("status", { name: "Loading v3" })).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load what changed.")).not.toBeInTheDocument();
  });

  it("waits for the previous version while the shown one is loaded", () => {
    setup({ versions: [V3, V2, V1], currentVersion: 3, shownVersion: 3, canEdit: true, states: { 2: "loading" } });

    expect(screen.getByRole("status", { name: "Loading v3" })).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load what changed.")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "web image" })).not.toBeInTheDocument();
  });

  it("says when the versions could not be loaded", () => {
    setup({ versions: [V3, V2, V1], currentVersion: 3, shownVersion: 3, canEdit: true, states: { 3: "failed", 2: "failed" } });

    expect(screen.getByText("Couldn't load what changed.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says when the previous version failed while the shown one is loaded", () => {
    setup({ versions: [V3, V2, V1], currentVersion: 3, shownVersion: 3, canEdit: true, states: { 2: "failed" } });

    expect(screen.getByText("Couldn't load what changed.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says when the shown version failed while the previous one is loading", () => {
    setup({ versions: [V3, V2, V1], currentVersion: 3, shownVersion: 3, canEdit: true, states: { 3: "failed", 2: "loading" } });

    expect(screen.getByText("Couldn't load what changed.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("caps the lines of a block and counts the rest", () => {
    const lines = (from: number, to: number) => Array.from({ length: to - from }, (_, index) => `K${from + index}=v`);
    const many = buildTemplateVersion({ version: 1, sdl: sdlOf("nginx:1.27", lines(0, 53)) });
    setup({ versions: [V1], currentVersion: 1, shownVersion: 1, canEdit: true, details: { 1: many } });

    const env = screen.getByRole("region", { name: "web env" });
    const items = within(env).getAllByRole("listitem");
    expect(items).toHaveLength(51);
    expect(items[0]).toHaveTextContent("+K0=v");
    expect(items[49]).toHaveTextContent("+K49=v");
    expect(items[50]).toHaveTextContent("+3 more");
  });

  it("does not cap a block that fits", () => {
    const lines = Array.from({ length: 50 }, (_, index) => `K${index}=v`);
    const exact = buildTemplateVersion({ version: 1, sdl: sdlOf("nginx:1.27", lines) });
    setup({ versions: [V1], currentVersion: 1, shownVersion: 1, canEdit: true, details: { 1: exact } });

    const env = screen.getByRole("region", { name: "web env" });
    expect(within(env).getAllByRole("listitem")).toHaveLength(50);
    expect(screen.queryByText(/more$/)).not.toBeInTheDocument();
  });

  it("lists a repeated env line once", () => {
    const repeated = buildTemplateVersion({ version: 1, sdl: sdlOf("nginx:1.27", ["A=1", "A=1"]) });
    setup({ versions: [V1], currentVersion: 1, shownVersion: 1, canEdit: true, details: { 1: repeated } });

    const env = screen.getByRole("region", { name: "web env" });
    expect(
      within(env)
        .getAllByRole("listitem")
        .map(line => line.textContent)
    ).toEqual(["+A=1"]);
  });

  it("shows no panel for an editor when no version is shown", () => {
    setup({ versions: [], currentVersion: undefined, shownVersion: undefined, canEdit: true });

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("shows – for versions saved before changes were recorded", () => {
    setup({ versions: [buildTemplateVersionSummary({ version: 1, changes: null, createdBy: null })], currentVersion: 1, canEdit: false });

    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells[2]).toHaveTextContent("–");
    expect(cells[4]).toHaveTextContent("–");
    expect(screen.queryByText("No changes recorded")).not.toBeInTheDocument();
  });

  function setup(input: {
    versions: TemplateVersionSummary[];
    currentVersion: number | undefined;
    shownVersion?: number;
    canEdit: boolean;
    details?: Record<number, TemplateVersionDetail>;
    states?: Partial<Record<number, "loading" | "failed">>;
  }) {
    const onView = vi.fn();
    const details = structuredClone(input.details ?? VERSION_DETAILS);
    const queries = new Map<number, VersionQuery>(
      Object.entries(details).map(([version, detail]) => [Number(version), mock<VersionQuery>({ data: detail, isLoading: false })])
    );
    const loadingQuery = mock<VersionQuery>({ data: undefined, isLoading: true });
    const failedQuery = mock<VersionQuery>({ data: undefined, isLoading: false });
    const idleQuery = mock<VersionQuery>({ data: undefined, isLoading: false });
    const useTemplateVersion = vi.fn<typeof DEPENDENCIES.useTemplateVersion>((_id, version) => {
      if (version === undefined) return idleQuery;
      const state = input.states?.[version];
      if (state === "loading") return loadingQuery;
      if (state === "failed") return failedQuery;
      return queries.get(version) ?? failedQuery;
    });
    const dependencies = MockComponents(DEPENDENCIES, { useTemplateVersion });

    const { container } = render(
      <TemplateVersionsTab
        templateId={TEMPLATE_ID}
        versions={structuredClone(input.versions)}
        currentVersion={input.currentVersion}
        shownVersion={"shownVersion" in input ? input.shownVersion : input.currentVersion}
        canEdit={input.canEdit}
        onView={onView}
        dependencies={dependencies}
      />
    );

    return { container, onView, useTemplateVersion };
  }
});
