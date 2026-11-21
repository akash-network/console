import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { TemplatePublishReadiness } from "@src/types/marketplace-template";
import type { PublishOrganization } from "../publishReadiness";
import type { DEPENDENCIES, SharedTemplate } from "./ShareTemplateDialog";
import { ShareTemplateDialog } from "./ShareTemplateDialog";

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildMarketplaceTemplate } from "@tests/seeders/userTemplate";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type ReadinessQuery = ReturnType<typeof DEPENDENCIES.useTemplatePublishReadiness>;
type PublishMutation = ReturnType<typeof DEPENDENCIES.usePublishTemplateMutation>;
type UpdateMutation = ReturnType<typeof DEPENDENCIES.useUpdateTemplateSettingsMutation>;
type PanelProps = Parameters<typeof DEPENDENCIES.PublishReadinessPanel>[0];

const SUPPORT_URL = "https://akash.network/support";
const TEAM: PublishOrganization = { name: "Northwind Labs", type: "team" };
const PERSONAL: PublishOrganization = { name: "sam.rivera", type: "personal" };
const TEMPLATE: SharedTemplate = {
  id: "tpl-webui",
  title: "Open WebUI + vLLM",
  visibility: "private",
  isListed: false,
  moderationStatus: "active",
  canEdit: true,
  currentVersion: { version: 4 }
};
const IN_GALLERY: SharedTemplate = { ...TEMPLATE, visibility: "public", isListed: true };
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
    { key: "fixed_tags", status: "passed", issues: [] }
  ],
  ranAt: "2026-11-18T18:00:00.000Z",
  canPublish: true
};
const BLOCKED: TemplatePublishReadiness = {
  ...READY,
  requirements: [
    { key: "email_verified", met: true },
    { key: "organization_payment", met: false },
    { key: "publisher_role", met: true },
    { key: "publisher_in_good_standing", met: true }
  ],
  checks: [
    { key: "sdl_valid", status: "passed", issues: [] },
    { key: "fixed_tags", status: "failed", issues: [{ message: "webui uses open-webui:latest." }] },
    { key: "name_not_reserved", status: "failed", issues: [{ message: "Titles can't contain Official.", field: "title" }] }
  ],
  canPublish: false
};

describe(ShareTemplateDialog.name, () => {
  describe("when the viewer may not change the template", () => {
    it("offers the link and nothing about who can use it", () => {
      const { useTemplatePublishReadiness } = setup({ template: { ...IN_GALLERY, canEdit: false } });

      expect(screen.getByRole("heading", { name: "Share Open WebUI + vLLM" })).toBeInTheDocument();
      expect(screen.getByText("Send the link to anyone who should deploy it.")).toBeInTheDocument();
      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
      expect(screen.queryByText(/In the gallery/)).not.toBeInTheDocument();
      expect(screen.getByText("Share outside: tpl-webui with badge")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Make public" })).not.toBeInTheDocument();
      expect(useTemplatePublishReadiness).toHaveBeenLastCalledWith("tpl-webui", { enabled: false });
    });
  });

  describe("visibility choices", () => {
    it("offers the three levels and marks the current one", () => {
      const { useTemplatePublishReadiness } = setup({});

      expect(screen.getByText("Choose who can find and deploy it.")).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "Who can find and deploy it" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Private Current Members of its project." })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Organization Everyone in Northwind Labs." })).not.toBeChecked();
      expect(screen.getByRole("radio", { name: "Public In the gallery under Northwind Labs. Anyone can deploy and fork it." })).not.toBeChecked();
      expect(screen.getByText("Share outside: tpl-webui link only")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
      expect(useTemplatePublishReadiness).toHaveBeenLastCalledWith("tpl-webui", { enabled: false });
    });

    it.each([
      ["a personal organization", PERSONAL],
      ["an unknown organization", null]
    ])("words the levels for %s", (_, organization) => {
      setup({ organization });

      expect(screen.getByRole("radio", { name: "Organization Everyone in your organization." })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Public In the gallery under your name. Anyone can deploy and fork it." })).toBeInTheDocument();
    });

    it("shows a title holding markup as inert text", () => {
      const title = '<img src=x onerror="alert(1)">';
      setup({ template: { ...TEMPLATE, title } });

      expect(screen.getByRole("heading", { name: `Share ${title}` })).toBeInTheDocument();
      expect(document.body.querySelector("img")).toBeNull();
    });

    it("closes on Escape", async () => {
      const { onClose } = setup({});

      await userEvent.keyboard("{Escape}");

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("making a template public", () => {
    it("runs the checks once Public is chosen and hands the result to the panel", async () => {
      const { useTemplatePublishReadiness, readPanelProps } = setup({ readiness: BLOCKED });

      await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));

      expect(useTemplatePublishReadiness).toHaveBeenLastCalledWith("tpl-webui", { enabled: true });
      expect(readPanelProps()).toEqual(
        expect.objectContaining({
          readiness: BLOCKED,
          organization: TEAM,
          isRunning: false,
          hasAcceptedTerms: false,
          supportUrl: SUPPORT_URL,
          fixLinks: {
            rename: "/template/tpl-webui?tab=settings",
            "rename-organization": "/organization",
            "edit-configuration": "/new-deployment/configure?templateMode=edit&userTemplateId=tpl-webui&baseVersion=4",
            "edit-readme": "/template/tpl-webui?tab=readme"
          }
        })
      );
    });

    it("has no organization settings to send a personal publisher to", async () => {
      const { readPanelProps } = setup({ organization: PERSONAL, readiness: READY });

      await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));

      expect(readPanelProps().fixLinks["rename-organization"]).toBeUndefined();
    });

    it("links a template without a version to Configure without a base version", async () => {
      const { readPanelProps } = setup({ template: { ...TEMPLATE, currentVersion: null }, readiness: READY });

      await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));

      expect(readPanelProps().fixLinks["edit-configuration"]).toBe("/new-deployment/configure?templateMode=edit&userTemplateId=tpl-webui");
    });

    it("falls back to the support email when no support page is configured", async () => {
      const { readPanelProps } = setup({ readiness: READY, supportUrl: "" });

      await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));

      expect(readPanelProps().supportUrl).toMatch(/^mailto:.+@.+/);
    });

    it("waits for the first run of the checks", async () => {
      const { PublishReadinessPanel } = setup({ readiness: undefined });

      await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));

      expect(screen.getByRole("status", { name: "Running the publish checks" })).toBeInTheDocument();
      expect(PublishReadinessPanel).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Make public" })).toBeDisabled();
      expect(screen.queryByText(/to make it public/)).not.toBeInTheDocument();
    });

    it("offers another try when the checks could not run", async () => {
      const { refetch } = setup({ readiness: undefined, isReadinessFailing: true });

      await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));
      expect(screen.getByText("Couldn't run the publish checks.")).toBeInTheDocument();
      expect(screen.queryByRole("status", { name: "Running the publish checks" })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("keeps Make public off when the checks could not run again after an earlier pass", async () => {
      setup({ readiness: READY, isReadinessFailing: true });

      await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));

      expect(screen.getByText("Couldn't run the publish checks.")).toBeInTheDocument();
      expect(screen.queryByText("Readiness panel")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Make public" })).toBeDisabled();
    });

    it("counts what is left to fix and keeps Make public off", async () => {
      const { readPanelProps } = setup({ readiness: BLOCKED });

      await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));
      act(() => readPanelProps().onAcceptedTermsChange(true));

      expect(screen.getByText("Fix 3 items to make it public")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Make public" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("counts a single thing left to fix in the singular", async () => {
      setup({ readiness: { ...BLOCKED, checks: READY.checks } });

      await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));

      expect(screen.getByText("Fix 1 item to make it public")).toBeInTheDocument();
    });

    it("keeps Make public off until the terms are accepted", async () => {
      const { readPanelProps } = setup({ readiness: READY });

      await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));
      expect(screen.queryByText(/to make it public/)).not.toBeInTheDocument();
      expect(screen.queryByText(/not in the gallery/)).not.toBeInTheDocument();
      expect(screen.getAllByRole("button").map(button => button.textContent)).toEqual(["Accept the terms", "Cancel", "Make public", "Close"]);
      expect(screen.getByRole("button", { name: "Make public" })).toBeDisabled();
      act(() => readPanelProps().onAcceptedTermsChange(true));

      expect(readPanelProps().hasAcceptedTerms).toBe(true);
      expect(screen.getByRole("button", { name: "Make public" })).toBeEnabled();
    });

    it("keeps the acceptance when the checks run again under the same terms", async () => {
      const { readPanelProps, showChecks } = setup({ readiness: READY });

      await acceptTerms();
      showChecks({ ...READY, ranAt: "2026-11-18T18:05:00.000Z" });

      expect(readPanelProps().hasAcceptedTerms).toBe(true);
      expect(screen.getByRole("button", { name: "Make public" })).toBeEnabled();
    });

    it("asks for the terms again when the checks come back under another terms version", async () => {
      const { readPanelProps, showChecks } = setup({ readiness: { ...READY, termsVersion: "2026-10" } });

      await acceptTerms();
      showChecks(READY);

      expect(readPanelProps().hasAcceptedTerms).toBe(false);
      expect(screen.getByRole("button", { name: "Make public" })).toBeDisabled();
    });

    it("asks for a reload when the API asks for terms this page does not show", async () => {
      const { readPanelProps } = setup({ readiness: { ...READY, termsVersion: "2026-12" } });

      await acceptTerms();

      expect(readPanelProps().hasAcceptedTerms).toBe(true);
      expect(screen.getByRole("alert")).toHaveTextContent("The community template terms changed since this page loaded. Reload the page to read them.");
      expect(screen.getByRole("button", { name: "Make public" })).toBeDisabled();
    });

    it("keeps Make public off while the checks run again", async () => {
      const { readPanelProps } = setup({ readiness: READY, isRunningChecks: true });

      await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));
      act(() => readPanelProps().onAcceptedTermsChange(true));

      expect(readPanelProps().isRunning).toBe(true);
      expect(screen.getByRole("button", { name: "Make public" })).toBeDisabled();
    });

    it("publishes with the terms version the user accepted and shows the template in the gallery", async () => {
      const { publish, enqueueSnackbar, useTemplatePublishReadiness, onClose } = setup({ readiness: READY });

      await acceptAndPublish();

      expect(publish).toHaveBeenCalledWith({ id: "tpl-webui", data: { acceptedTermsVersion: "2026-11" } });
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({ title: "The template is public", subTitle: "It's in the gallery now.", iconVariant: "success" })
        }),
        { variant: "success" }
      );
      expect(screen.getByText("In the gallery.")).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /^Public Current/ })).toBeChecked();
      expect(screen.getByText("Share outside: tpl-webui with badge")).toBeInTheDocument();
      expect(screen.queryByText("Readiness panel")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Make public" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
      expect(useTemplatePublishReadiness).toHaveBeenLastCalledWith("tpl-webui", { enabled: false });
      expect(onClose).not.toHaveBeenCalled();
    });

    it.each([
      [
        "a requirement that is no longer met",
        new ApiError(403, { code: "template_publish_requirements_unmet", message: "Unmet" }, "403"),
        "A requirement is no longer met. The list below shows what changed."
      ],
      [
        "a check that no longer passes",
        new ApiError(400, { code: "template_publish_checks_failed", message: "webui uses open-webui:latest." }, "400"),
        "A publish check no longer passes. The list below shows what changed."
      ]
    ])("runs the checks again after %s", async (_, publishError, message) => {
      const { refetch, readPanelProps } = setup({ readiness: READY, publishError });

      await acceptAndPublish();

      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(refetch).toHaveBeenCalledTimes(1);
      expect(readPanelProps().hasAcceptedTerms).toBe(true);
      expect(screen.queryByText("In the gallery.")).not.toBeInTheDocument();
    });

    it("asks for the terms again when they changed", async () => {
      const { refetch, readPanelProps, enqueueSnackbar } = setup({
        readiness: READY,
        publishError: new ApiError(409, { code: "template_terms_version_mismatch", data: { termsVersion: "2026-12" } }, "409")
      });

      await acceptAndPublish();

      expect(screen.getByRole("alert")).toHaveTextContent("The community template terms changed. Read the new terms and accept them again.");
      expect(refetch).toHaveBeenCalledTimes(1);
      expect(readPanelProps().hasAcceptedTerms).toBe(false);
      expect(screen.getByRole("button", { name: "Make public" })).toBeDisabled();
      expect(enqueueSnackbar).not.toHaveBeenCalled();
    });

    it.each([
      [
        "the server's wording of a rate limit",
        new ApiError(429, { code: "template_rate_limited", message: "You reached the limit of 10 published templates per day. Try again in 3 hours." }, "429"),
        "You reached the limit of 10 published templates per day. Try again in 3 hours."
      ],
      ["that the template is no longer theirs to change", new ApiError(404, { message: "Not found" }, "404"), "You can no longer change this template."],
      ["a failure nobody planned for", new Error("boom"), "Couldn't make it public. Try again in a moment."]
    ])("shows %s without running the checks again", async (_, publishError, message) => {
      const { refetch, readPanelProps } = setup({ readiness: READY, publishError });

      await acceptAndPublish();

      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(refetch).not.toHaveBeenCalled();
      expect(readPanelProps().hasAcceptedTerms).toBe(true);
    });

    it("clears a failure once another level is chosen", async () => {
      setup({ readiness: READY, publishError: new Error("boom") });

      await acceptAndPublish();
      expect(screen.getByRole("alert")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("radio", { name: /^Organization/ }));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("clears the last failure when the user tries again", async () => {
      const { publish } = setup({ readiness: READY, publishError: new Error("boom") });

      await acceptAndPublish();
      publish.mockImplementation(async () => ({ data: buildMarketplaceTemplate({ id: "tpl-webui", visibility: "public", isListed: true }) }));
      await userEvent.click(screen.getByRole("button", { name: "Make public" }));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText("In the gallery.")).toBeInTheDocument();
    });

    it("starts the email verification and runs the checks again once verified", async () => {
      const { readPanelProps, runWhenEmailVerified, refetch } = setup({ readiness: BLOCKED });

      await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));
      act(() => readPanelProps().onVerifyEmail());

      expect(runWhenEmailVerified).toHaveBeenCalledWith("Verify your email to make a template public.", expect.any(Function));
      expect(refetch).not.toHaveBeenCalled();
      runWhenEmailVerified.mock.calls[0][1]();
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["credits are added", (props: PanelProps) => props.onCreditsAdded()],
      ["the user asks for another run", (props: PanelProps) => props.onRunAgain()]
    ])("runs the checks again when %s", async (_, trigger) => {
      const { readPanelProps, refetch } = setup({ readiness: BLOCKED });

      await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));
      act(() => trigger(readPanelProps()));

      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("closes when the user follows a fix to another page", async () => {
      const { readPanelProps, onClose } = setup({ readiness: BLOCKED });

      await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));
      act(() => readPanelProps().onFollowFix());

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("stays open and locked while the publish is under way", async () => {
      const { onClose, publish, readPanelProps } = setup({ readiness: READY, isPublishing: true, template: { ...IN_GALLERY, isListed: false } });

      act(() => readPanelProps().onAcceptedTermsChange(true));
      await userEvent.keyboard("{Escape}");

      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      expect(screen.getByRole("button", { name: /Add to gallery/ })).toBeDisabled();
      expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /^Private/ })).toBeDisabled();
      expect(onClose).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it("offers the close button while nothing is under way", () => {
      setup({});

      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /^Public/ })).toBeEnabled();
    });
  });

  describe("sharing with members only", () => {
    it("shares a private template with the organization", async () => {
      const { updateSettings, enqueueSnackbar } = setup({});

      await userEvent.click(screen.getByRole("radio", { name: /^Organization/ }));
      expect(screen.queryByText(/takes it out of the gallery/)).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Share with organization only" }));

      expect(updateSettings).toHaveBeenCalledWith({ id: "tpl-webui", data: { visibility: "organization" } });
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ title: "Shared with your organization", iconVariant: "success" }) }),
        { variant: "success" }
      );
      expect(screen.getByRole("radio", { name: /^Organization Current/ })).toBeChecked();
      expect(screen.queryByRole("button", { name: "Share with organization only" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    });

    it("makes an organization template private", async () => {
      const { updateSettings, enqueueSnackbar } = setup({ template: { ...TEMPLATE, visibility: "organization" } });

      await userEvent.click(screen.getByRole("radio", { name: /^Private/ }));
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Make private" }));

      expect(updateSettings).toHaveBeenCalledWith({ id: "tpl-webui", data: { visibility: "private" } });
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "The template is private" }) }), {
        variant: "success"
      });
      expect(screen.getByRole("radio", { name: /^Private Current/ })).toBeChecked();
    });

    it.each([
      [
        "why the API refused",
        new ApiError(400, { code: "template_invalid", message: "Invalid", data: { issues: ["web: env HF_TOKEN holds a secret"] } }, "400"),
        "web: env HF_TOKEN holds a secret"
      ],
      ["that the template is no longer theirs to change", new ApiError(403, { message: "Forbidden" }, "403"), "You can no longer change this template."],
      ["a failure nobody planned for", new ApiError(503, { message: "Unavailable" }, "503"), "Try again in a moment."]
    ])("shows %s when the change is refused", async (_, updateError, message) => {
      const { enqueueSnackbar } = setup({ updateError });

      await userEvent.click(screen.getByRole("radio", { name: /^Organization/ }));
      await userEvent.click(screen.getByRole("button", { name: "Share with organization only" }));

      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(screen.getByRole("radio", { name: /^Private Current/ })).toBeInTheDocument();
      expect(enqueueSnackbar).not.toHaveBeenCalled();
    });

    it("clears the last refusal when the change is tried again", async () => {
      const { updateSettings } = setup({ updateError: new ApiError(503, null, "503") });

      await userEvent.click(screen.getByRole("radio", { name: /^Organization/ }));
      await userEvent.click(screen.getByRole("button", { name: "Share with organization only" }));
      expect(screen.getByRole("alert")).toBeInTheDocument();
      updateSettings.mockImplementation(() => new Promise(() => undefined));
      await userEvent.click(screen.getByRole("button", { name: "Share with organization only" }));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("locks the dialog while the change is under way", async () => {
      const { onClose } = setup({ isChangingVisibility: true });

      await userEvent.keyboard("{Escape}");

      expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
      expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("when the template is already public", () => {
    it("says it is in the gallery and offers the badge", () => {
      const { useTemplatePublishReadiness } = setup({ template: IN_GALLERY });

      expect(screen.getByRole("radio", { name: /^Public Current/ })).toBeChecked();
      expect(screen.getByText("In the gallery.")).toBeInTheDocument();
      expect(screen.getByText(/Anyone can find, deploy and fork it\./)).toBeInTheDocument();
      expect(screen.getByText("Share outside: tpl-webui with badge")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Make public" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Add to gallery" })).not.toBeInTheDocument();
      expect(useTemplatePublishReadiness).toHaveBeenLastCalledWith("tpl-webui", { enabled: false });
    });

    it("ignores a result of the checks left over from before it was listed", () => {
      const { PublishReadinessPanel } = setup({ template: IN_GALLERY, readiness: BLOCKED });

      expect(PublishReadinessPanel).not.toHaveBeenCalled();
      expect(screen.queryByText(/to make it public/)).not.toBeInTheDocument();
    });

    it("explains a template that is public but was never listed, and lists it through the checks", async () => {
      const { useTemplatePublishReadiness, publish, readPanelProps } = setup({ template: { ...IN_GALLERY, isListed: false }, readiness: READY });

      expect(screen.getByText("Public by link, but not in the gallery.")).toBeInTheDocument();
      expect(screen.getByText(/It went public before publish checks existed\. Pass the checks and accept the terms to list it\./)).toBeInTheDocument();
      expect(screen.queryByText("In the gallery.")).not.toBeInTheDocument();
      expect(useTemplatePublishReadiness).toHaveBeenLastCalledWith("tpl-webui", { enabled: true });
      expect(screen.getByText("Share outside: tpl-webui with badge")).toBeInTheDocument();
      act(() => readPanelProps().onAcceptedTermsChange(true));
      await userEvent.click(screen.getByRole("button", { name: "Add to gallery" }));

      expect(publish).toHaveBeenCalledWith({ id: "tpl-webui", data: { acceptedTermsVersion: "2026-11" } });
      expect(screen.getByText("In the gallery.")).toBeInTheDocument();
    });

    it("says Akash hid it, sends the owner to support and offers no badge", () => {
      const { useTemplatePublishReadiness, PublishReadinessPanel } = setup({ template: { ...IN_GALLERY, moderationStatus: "hidden" }, readiness: READY });

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Akash hid this template, so it stays out of the gallery and nobody outside your organization can open it."
      );
      expect(screen.getByRole("link", { name: "Contact support" })).toHaveAttribute("href", SUPPORT_URL);
      expect(screen.queryByText("In the gallery.")).not.toBeInTheDocument();
      expect(screen.getByText("Share outside: tpl-webui link only")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Make public" })).not.toBeInTheDocument();
      expect(PublishReadinessPanel).not.toHaveBeenCalled();
      expect(useTemplatePublishReadiness).toHaveBeenLastCalledWith("tpl-webui", { enabled: false });
    });

    it("keeps a hidden private template away from the publish checks", async () => {
      const { useTemplatePublishReadiness } = setup({ template: { ...TEMPLATE, moderationStatus: "hidden" }, readiness: READY });

      await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));

      expect(screen.getByRole("alert")).toHaveTextContent(/Akash hid this template/);
      expect(useTemplatePublishReadiness).toHaveBeenLastCalledWith("tpl-webui", { enabled: false });
    });

    it("asks before taking it out of the gallery and lets the owner keep it public", async () => {
      const { updateSettings } = setup({ template: IN_GALLERY });

      await userEvent.click(screen.getByRole("radio", { name: /^Private/ }));
      expect(
        screen.getByText("This takes it out of the gallery and turns off its public link. Deployments and forks made from it keep working.")
      ).toBeInTheDocument();
      expect(screen.queryByText("In the gallery.")).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Make private" }));

      expect(screen.getByText("Take it out of the gallery?")).toBeInTheDocument();
      expect(
        screen.getByText(
          "The template leaves the gallery and its link stops working for anyone outside its project. Deployments and forks made from it keep working."
        )
      ).toBeInTheDocument();
      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
      expect(updateSettings).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("button", { name: "Keep it public" }));

      expect(screen.queryByText("Take it out of the gallery?")).not.toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /^Public Current/ })).toBeChecked();
      expect(screen.queryByText(/turns off its public link/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Make private" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
      expect(updateSettings).not.toHaveBeenCalled();
    });

    it("asks before unpublishing a template someone else published after a change made in the dialog", async () => {
      const { updateSettings, showTemplate } = setup({ template: TEMPLATE });

      await userEvent.click(screen.getByRole("radio", { name: /^Organization/ }));
      await userEvent.click(screen.getByRole("button", { name: "Share with organization only" }));
      showTemplate(IN_GALLERY);
      await userEvent.click(screen.getByRole("radio", { name: /^Private/ }));
      await userEvent.click(screen.getByRole("button", { name: "Make private" }));

      expect(screen.getByText("Take it out of the gallery?")).toBeInTheDocument();
      expect(updateSettings).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["its visibility", { visibility: "organization" }, /^Organization Current/],
      ["its listing", { isListed: false }, /^Public Current/],
      ["its moderation", { moderationStatus: "hidden" }, /^Public Current/]
    ] as const)("follows the template once someone else changes %s after a change made in the dialog", async (_, change, current) => {
      const { showTemplate } = setup({ template: IN_GALLERY });

      fireEvent.click(screen.getByRole("radio", { name: /^Private/ }));
      fireEvent.click(screen.getByRole("button", { name: "Make private" }));
      await userEvent.click(screen.getByRole("button", { name: "Make private" }));
      expect(screen.getByRole("radio", { name: /^Private Current/ })).toBeChecked();
      showTemplate({ ...IN_GALLERY, ...change });

      expect(screen.getByRole("radio", { name: current })).toBeInTheDocument();
      expect(screen.queryByRole("radio", { name: /^Private Current/ })).not.toBeInTheDocument();
    });

    it("makes it private once confirmed and takes the badge away", async () => {
      const { updateSettings } = setup({ template: IN_GALLERY });

      fireEvent.click(screen.getByRole("radio", { name: /^Private/ }));
      fireEvent.click(screen.getByRole("button", { name: "Make private" }));
      await userEvent.click(screen.getByRole("button", { name: "Make private" }));

      expect(updateSettings).toHaveBeenCalledWith({ id: "tpl-webui", data: { visibility: "private" } });
      expect(screen.queryByText("Take it out of the gallery?")).not.toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /^Private Current/ })).toBeChecked();
      expect(screen.getByText("Share outside: tpl-webui link only")).toBeInTheDocument();
    });

    it.each([
      ["a team", TEAM, "Northwind Labs"],
      ["a personal organization", PERSONAL, "your organization"],
      ["an unknown organization", null, "your organization"]
    ])("names who keeps access when it goes back to %s", async (_, organization, audience) => {
      setup({ template: IN_GALLERY, organization });

      await userEvent.click(screen.getByRole("radio", { name: /^Organization/ }));
      await userEvent.click(screen.getByRole("button", { name: "Share with organization only" }));

      expect(screen.getByText(new RegExp(`stops working for anyone outside ${audience}\\.`))).toBeInTheDocument();
    });

    it("returns to the choices with the reason when the change is refused", async () => {
      setup({ template: IN_GALLERY, updateError: new ApiError(503, null, "503") });

      fireEvent.click(screen.getByRole("radio", { name: /^Private/ }));
      fireEvent.click(screen.getByRole("button", { name: "Make private" }));
      await userEvent.click(screen.getByRole("button", { name: "Make private" }));

      expect(screen.queryByText("Take it out of the gallery?")).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("Try again in a moment.");
      expect(screen.getByRole("radio", { name: /^Public Current/ })).toBeInTheDocument();
    });

    it("asks for the terms again after a template went private and is made public once more", async () => {
      const { readPanelProps } = setup({ template: { ...IN_GALLERY, isListed: false }, readiness: READY });

      act(() => readPanelProps().onAcceptedTermsChange(true));
      fireEvent.click(screen.getByRole("radio", { name: /^Private/ }));
      fireEvent.click(screen.getByRole("button", { name: "Make private" }));
      fireEvent.click(screen.getByRole("button", { name: "Make private" }));
      fireEvent.click(await screen.findByRole("radio", { name: /^Public/ }));

      expect(readPanelProps().hasAcceptedTerms).toBe(false);
      expect(screen.getByRole("button", { name: "Make public" })).toBeDisabled();
    });
  });

  async function acceptTerms() {
    await userEvent.click(screen.getByRole("radio", { name: /^Public/ }));
    await userEvent.click(screen.getByRole("button", { name: "Accept the terms" }));
  }

  async function acceptAndPublish() {
    await acceptTerms();
    await userEvent.click(screen.getByRole("button", { name: "Make public" }));
  }

  function setup(input: {
    template?: SharedTemplate;
    organization?: PublishOrganization | null;
    readiness?: TemplatePublishReadiness;
    isReadinessFailing?: boolean;
    isRunningChecks?: boolean;
    isPublishing?: boolean;
    isChangingVisibility?: boolean;
    publishError?: unknown;
    updateError?: unknown;
    supportUrl?: string;
  }) {
    const template = input.template ?? TEMPLATE;
    const onClose = vi.fn();
    const refetch = vi.fn();
    const enqueueSnackbar = vi.fn();
    const runWhenEmailVerified = vi.fn<ReturnType<typeof DEPENDENCIES.useRunWhenEmailVerified>>();
    const publish = vi.fn<PublishMutation["mutateAsync"]>(async () => {
      if (input.publishError) throw input.publishError;
      return { data: buildMarketplaceTemplate({ id: template.id, visibility: "public", isListed: true }) };
    });
    const updateSettings = vi.fn<UpdateMutation["mutateAsync"]>(async ({ data }) => {
      if (input.updateError) throw input.updateError;
      return { data: buildMarketplaceTemplate({ id: template.id, visibility: data.visibility, isListed: false }) };
    });
    const readinessQuery = mock<ReadinessQuery>({
      isError: input.isReadinessFailing ?? false,
      isFetching: input.isRunningChecks ?? false,
      refetch
    });
    readinessQuery.data = input.readiness;
    const publishMutation = mock<PublishMutation>({ mutateAsync: publish, isPending: input.isPublishing ?? false });
    const updateMutation = mock<UpdateMutation>({ mutateAsync: updateSettings, isPending: input.isChangingVisibility ?? false });
    const snackbar = mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar });
    const useTemplatePublishReadiness = vi.fn<typeof DEPENDENCIES.useTemplatePublishReadiness>(() => readinessQuery);
    const PublishReadinessPanel = vi.fn<typeof DEPENDENCIES.PublishReadinessPanel>(props => (
      <div>
        <p>Readiness panel</p>
        <button type="button" onClick={() => props.onAcceptedTermsChange(true)}>
          Accept the terms
        </button>
      </div>
    ));
    const ShareOutsideSection = vi.fn<typeof DEPENDENCIES.ShareOutsideSection>(({ templateId, hasBadge }) => (
      <p>
        Share outside: {templateId} {hasBadge ? "with badge" : "link only"}
      </p>
    ));
    const publicConfig = mock<AppDIContainer["publicConfig"]>({
      NEXT_PUBLIC_CONTACT_SUPPORT_URL: input.supportUrl ?? SUPPORT_URL
    });

    const renderDialog = (shownTemplate: SharedTemplate) => (
      <TestContainerProvider services={{ publicConfig: () => publicConfig }}>
        <ShareTemplateDialog
          template={shownTemplate}
          organization={input.organization === undefined ? TEAM : input.organization}
          onClose={onClose}
          dependencies={{
            PublishReadinessPanel,
            ShareOutsideSection,
            useTemplatePublishReadiness,
            usePublishTemplateMutation: () => publishMutation,
            useUpdateTemplateSettingsMutation: () => updateMutation,
            useRunWhenEmailVerified: () => runWhenEmailVerified,
            useSnackbar: () => snackbar
          }}
        />
      </TestContainerProvider>
    );
    const view = render(renderDialog(template));

    const showTemplate = (next: SharedTemplate) => view.rerender(renderDialog(next));
    const showChecks = (next: TemplatePublishReadiness) => {
      readinessQuery.data = next;
      view.rerender(renderDialog(template));
    };
    const readPanelProps = () => PublishReadinessPanel.mock.lastCall?.[0] as PanelProps;

    return {
      onClose,
      refetch,
      enqueueSnackbar,
      runWhenEmailVerified,
      publish,
      updateSettings,
      useTemplatePublishReadiness,
      PublishReadinessPanel,
      readPanelProps,
      showTemplate,
      showChecks
    };
  }
});
