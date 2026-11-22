import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import type { TemplatePublishCheck, TemplatePublishReadiness } from "@src/types/marketplace-template";
import type { PublishOrganization } from "../publishReadiness";
import type { PublishFixLinks } from "../publishReadiness";
import type { DEPENDENCIES } from "./PublishReadinessPanel";
import { PublishReadinessPanel } from "./PublishReadinessPanel";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const TEAM: PublishOrganization = { name: "Northwind Labs", type: "team" };
const SUPPORT_URL = "https://support.example.com";
const FIX_LINKS: PublishFixLinks = {
  rename: "/template/tpl-1?tab=settings",
  "rename-organization": "/organization",
  "edit-configuration": "/new-deployment/configure?templateMode=edit&userTemplateId=tpl-1",
  "edit-readme": "/template/tpl-1?tab=readme",
  "edit-summary": "/template/tpl-1?tab=settings"
};
const READY: TemplatePublishReadiness = {
  termsVersion: "2026-11",
  requirements: [
    { key: "email_verified", met: true },
    { key: "organization_payment", met: true },
    { key: "publisher_role", met: true },
    { key: "publisher_in_good_standing", met: true }
  ],
  checks: [
    { key: "sdl_valid", status: "passed", issues: [] },
    { key: "no_secrets", status: "passed", issues: [] },
    { key: "images_allowed", status: "passed", issues: [] },
    { key: "fixed_tags", status: "passed", issues: [] },
    { key: "name_not_reserved", status: "passed", issues: [] }
  ],
  ranAt: "2026-11-18T18:00:00.000Z",
  canPublish: true
};

describe(PublishReadinessPanel.name, () => {
  it("lists each requirement as met without help or actions", () => {
    setup({});

    const rows = within(screen.getByRole("list", { name: "Before you can make it public" })).getAllByRole("listitem");
    expect(rows.map(row => row.textContent)).toEqual([
      "MetEmail verified",
      "MetOrganization has a successful payment",
      "MetOwner or admin of Northwind Labs",
      "MetPublisher in good standing"
    ]);
    expect(screen.queryByRole("button", { name: "Verify email" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add credits" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Contact support" })).not.toBeInTheDocument();
  });

  it("explains an unverified email and starts the verification", async () => {
    const { onVerifyEmail } = setup({ unmet: ["email_verified"] });

    expect(screen.getByText("Public templates come from people with a verified email.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Verify email" }));

    expect(onVerifyEmail).toHaveBeenCalledTimes(1);
  });

  it("puts a requirement's action under its explanation on a narrow screen and beside it from the sm breakpoint up", () => {
    setup({ unmet: ["email_verified"] });

    expect(screen.getByRole("button", { name: "Verify email" }).parentElement).toHaveClass("shrink-0", "basis-full", "pl-8", "sm:basis-auto", "sm:pl-0");
  });

  it("explains the missing payment and opens Add credits for it", () => {
    const { AddFundsButton, onCreditsAdded } = setup({ unmet: ["organization_payment"] });

    expect(screen.getByText("Public templates need at least one completed payment on Northwind Labs. Trial credits don't count.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add credits" })).toBeInTheDocument();
    expect(AddFundsButton).toHaveBeenCalledWith(
      expect.objectContaining({ request: { context: "template_publish", suggestFirstDeployment: false, onCreditsAdded } }),
      expect.anything()
    );
  });

  it("tells a member who may not publish whom to ask, with nothing to click", () => {
    setup({ unmet: ["publisher_role"] });

    const row = screen.getByText("Owner or admin of Northwind Labs").closest("li") as HTMLElement;
    expect(row).toHaveTextContent("Not met");
    expect(row).toHaveTextContent("Ask an owner or admin of Northwind Labs.");
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    expect(within(row).queryByRole("link")).not.toBeInTheDocument();
  });

  it("sends a suspended publisher to support", () => {
    setup({ unmet: ["publisher_in_good_standing"] });

    const link = screen.getByRole("link", { name: "Contact support" });
    expect(link).toHaveAttribute("href", SUPPORT_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows an organization name holding markup as inert text", () => {
    const name = '<img src=x onerror="alert(1)">';
    const { container } = setup({ organization: { name, type: "team" }, unmet: ["publisher_role"] });

    expect(screen.getByText(`Owner or admin of ${name}`)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("says when the checks ran and runs them again", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-18T18:00:12.000Z"), toFake: ["Date"] });
    const { onRunAgain } = setup({});
    vi.useRealTimers();

    expect(screen.getByText(/Ran 12 seconds ago/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Run again" }));

    expect(onRunAgain).toHaveBeenCalledTimes(1);
  });

  it("shows the checks as running instead of offering another run", () => {
    setup({ isRunning: true });

    expect(screen.getByText("Running the checks…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run again" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Ran /)).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Publish checks" })).toHaveClass("opacity-60");
  });

  it("leaves the checks at full strength once they ran", () => {
    setup({});

    expect(screen.getByRole("list", { name: "Publish checks" })).not.toHaveClass("opacity-60");
  });

  it("links a failed check to where it is fixed and leaves the dialog", async () => {
    const { onFollowFix } = setup({
      checks: [
        { key: "fixed_tags", status: "failed", issues: [{ message: "webui uses open-webui:latest." }] },
        {
          key: "name_not_reserved",
          status: "failed",
          issues: [
            { message: "Titles can't contain Official.", field: "title" },
            { message: "Publisher names can't contain Akash.", field: "publisher_name" }
          ]
        }
      ]
    });

    expect(screen.getByText("webui uses open-webui:latest.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit configuration" })).toHaveAttribute("href", FIX_LINKS["edit-configuration"]);
    expect(screen.getByRole("link", { name: "Organization settings" })).toHaveAttribute("href", "/organization");
    const rename = screen.getByRole("link", { name: "Rename" });
    expect(rename).toHaveAttribute("href", "/template/tpl-1?tab=settings");
    rename.addEventListener("click", event => event.preventDefault());
    await userEvent.click(rename);

    expect(onFollowFix).toHaveBeenCalledTimes(1);
  });

  it("links a credential found in the README to the README tab", () => {
    setup({ checks: [{ key: "no_secrets", status: "failed", issues: [{ message: "The README holds an API key.", field: "readme" }] }] });

    expect(screen.getByRole("link", { name: "Edit README" })).toHaveAttribute("href", "/template/tpl-1?tab=readme");
    expect(screen.queryByRole("link", { name: "Edit configuration" })).not.toBeInTheDocument();
  });

  it("links each text over its limit to the place it is edited", () => {
    setup({
      checks: [
        {
          key: "text_within_limits",
          status: "failed",
          issues: [
            { message: "The title is too long.", field: "title" },
            { message: "The summary is too long.", field: "summary" },
            { message: "The README is too long.", field: "readme" }
          ]
        }
      ]
    });

    expect(screen.getByText("Title, summary and README within their length limits")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rename" })).toHaveAttribute("href", "/template/tpl-1?tab=settings");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/template/tpl-1?tab=settings");
    expect(screen.getByRole("link", { name: "Edit README" })).toHaveAttribute("href", "/template/tpl-1?tab=readme");
  });

  it("offers no link for a fix that has nowhere to go", () => {
    setup({
      fixLinks: { ...FIX_LINKS, "rename-organization": undefined },
      checks: [{ key: "name_not_reserved", status: "failed", issues: [{ message: "Publisher names can't contain Akash.", field: "publisher_name" }] }]
    });

    expect(screen.getByText("Publisher names can't contain Akash.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Organization settings" })).not.toBeInTheDocument();
  });

  it("asks for the community template terms and reports the answer", async () => {
    const { onAcceptedTermsChange } = setup({});
    const checkbox = screen.getByRole("checkbox", {
      name: "I agree to the community template terms: anyone can deploy and fork this template, and Akash can hide or remove it."
    });

    expect(checkbox).not.toBeChecked();
    expect(screen.getByText("Terms version 2026-11")).toBeInTheDocument();
    await userEvent.click(checkbox);

    expect(onAcceptedTermsChange).toHaveBeenCalledWith(true);
  });

  it("reports the terms as declined when the box is cleared", async () => {
    const { onAcceptedTermsChange } = setup({ hasAcceptedTerms: true });
    const checkbox = screen.getByRole("checkbox");

    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);

    expect(onAcceptedTermsChange).toHaveBeenCalledWith(false);
  });

  function setup(input: {
    unmet?: TemplatePublishReadiness["requirements"][number]["key"][];
    checks?: TemplatePublishCheck[];
    organization?: PublishOrganization | null;
    isRunning?: boolean;
    hasAcceptedTerms?: boolean;
    fixLinks?: PublishFixLinks;
  }) {
    const onRunAgain = vi.fn();
    const onAcceptedTermsChange = vi.fn();
    const onVerifyEmail = vi.fn();
    const onCreditsAdded = vi.fn();
    const onFollowFix = vi.fn();
    const AddFundsButton = vi.fn((props: ComponentProps<typeof DEPENDENCIES.AddFundsButton>) => <button type="button">{props.children}</button>);
    const readiness: TemplatePublishReadiness = {
      ...READY,
      requirements: READY.requirements.map(requirement => ({ ...requirement, met: !input.unmet?.includes(requirement.key) })),
      checks: input.checks ?? READY.checks
    };

    const result = render(
      <PublishReadinessPanel
        readiness={readiness}
        organization={input.organization === undefined ? TEAM : input.organization}
        isRunning={input.isRunning ?? false}
        hasAcceptedTerms={input.hasAcceptedTerms ?? false}
        fixLinks={input.fixLinks ?? FIX_LINKS}
        supportUrl={SUPPORT_URL}
        onRunAgain={onRunAgain}
        onAcceptedTermsChange={onAcceptedTermsChange}
        onVerifyEmail={onVerifyEmail}
        onCreditsAdded={onCreditsAdded}
        onFollowFix={onFollowFix}
        dependencies={{ AddFundsButton }}
      />
    );

    return { ...result, onRunAgain, onAcceptedTermsChange, onVerifyEmail, onCreditsAdded, onFollowFix, AddFundsButton };
  }
});
