import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantAction, AssistantActionType } from "@src/types/assistant";
import { UrlService } from "@src/utils/urlUtils";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import { actionTitleOf, consoleHrefOf, GenericActionCard, summaryRowsOf } from "./GenericActionCard";

import { render, screen } from "@testing-library/react";

describe(GenericActionCard.name, () => {
  it("summarizes the proposal and links to where the user can do it, with nothing to confirm", () => {
    setup({ action: { type: "rename_deployment", tier: "confirm", dseq: "42", from: null, to: "llama-api" } });

    const card = screen.getByRole("region", { name: "Rename the deployment" });
    expect(card).not.toHaveTextContent("42");
    expect(card).toHaveTextContent("Tollama-api");
    expect(card).not.toHaveTextContent("From");
    expect(screen.getByRole("link", { name: "Open in Console" })).toHaveAttribute("href", UrlService.deploymentDetails("42"));
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
  });

  it("drops the link once the card is dismissed, and has none for an action without a page", () => {
    setup({ action: { type: "rename_deployment", tier: "confirm", dseq: "42", from: null, to: "x" }, status: "cancelled" });
    expect(screen.queryByRole("link", { name: "Open in Console" })).not.toBeInTheDocument();
  });

  describe(actionTitleOf.name, () => {
    it.each<[AssistantActionType, string]>([
      ["create_deployment", "Create a deployment"],
      ["choose_bid", "Choose a provider"],
      ["update_deployment", "Update the deployment"],
      ["set_secret", "Set a secret"],
      ["set_registry_credentials", "Set registry credentials"],
      ["redeploy_with_resources", "Redeploy with different resources"],
      ["rename_deployment", "Rename the deployment"],
      ["move_deployment", "Move the deployment"],
      ["add_runtime_hours", "Add runtime hours"],
      ["remove_runtime_limit", "Remove the runtime limit"],
      ["send_manifest_again", "Send the deployment again"],
      ["close_deployment", "Close the deployment"],
      ["create_alert", "Create an alert"],
      ["redeem_coupon", "Redeem a coupon"],
      ["save_as_template", "Save as a template"],
      ["favorite_provider", "Favorite a provider"],
      ["request_hardware", "Request hardware"],
      ["buy_credits", "Buy credits"],
      ["configure_auto_recharge", "Set up auto recharge"],
      ["open_in_editor", "Open in the editor"]
    ])("titles a %s proposal %s", (type, title) => {
      expect(actionTitleOf(type)).toBe(title);
    });
  });

  describe(summaryRowsOf.name, () => {
    it("lists scalar fields with readable labels and leaves out the type, tier, SDL, dseq, provider address and nested data", () => {
      const rows = summaryRowsOf({
        type: "request_hardware",
        tier: "confirm",
        gpuModel: "H100",
        gpuCount: 8,
        interconnect: "cluster",
        notes: null
      });

      expect(rows).toEqual([
        { label: "GPU model", value: "H100" },
        { label: "GPU count", value: "8" },
        { label: "Interconnect", value: "cluster" }
      ]);
      expect(summaryRowsOf({ type: "favorite_provider", tier: "confirm", provider: "akash1p" })).toEqual([]);
      expect(summaryRowsOf({ type: "open_in_editor", tier: "deep_link", dseq: null, templateId: "t", sdl: "version: 2" })).toEqual([
        { label: "Template ID", value: "t" }
      ]);
      expect(
        summaryRowsOf({ type: "add_runtime_hours", tier: "confirm", dseq: "1", hours: 2, currentLimitHours: 4, newLimitHours: 6, runtimeEndsAt: null })
      ).toContainEqual({
        label: "New limit hours",
        value: "6"
      });
    });
  });

  describe(consoleHrefOf.name, () => {
    it("points each action at the page that handles it", () => {
      expect(consoleHrefOf({ type: "send_manifest_again", tier: "confirm", dseq: "42" })).toBe(UrlService.deploymentDetails("42"));
      expect(consoleHrefOf({ type: "buy_credits", tier: "deep_link", amountUsd: 20 })).toBe(UrlService.billing());
      expect(consoleHrefOf({ type: "configure_auto_recharge", tier: "deep_link", thresholdUsd: null, amountUsd: null })).toBe(UrlService.billing());
      expect(consoleHrefOf({ type: "redeem_coupon", tier: "confirm", code: null })).toBe(UrlService.billing());
      expect(consoleHrefOf({ type: "create_alert", tier: "confirm", alert: "deployment_closed", dseq: "7", channel: "email" })).toBe(
        UrlService.deploymentDetails("7")
      );
      expect(consoleHrefOf({ type: "favorite_provider", tier: "confirm", provider: "akash1p" })).toBe(UrlService.providerDetail("akash1p"));
      expect(consoleHrefOf({ type: "request_hardware", tier: "confirm", gpuModel: "H100", gpuCount: 1, interconnect: "none", notes: null })).toBeNull();
      expect(consoleHrefOf({ type: "open_in_editor", tier: "deep_link", dseq: null, templateId: null, sdl: null })).toBeNull();
    });
  });

  function setup(input: { action: AssistantAction; status?: ActionCardDecision["status"] }) {
    const decision = mock<ActionCardDecision>({ status: input.status ?? "pending", error: null });
    render(<GenericActionCard action={input.action} decision={decision} />);
  }
});
