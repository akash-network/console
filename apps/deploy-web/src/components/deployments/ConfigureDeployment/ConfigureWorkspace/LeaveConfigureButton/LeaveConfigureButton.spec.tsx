import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./LeaveConfigureButton";
import { LeaveConfigureButton } from "./LeaveConfigureButton";

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(LeaveConfigureButton.name, () => {
  it("follows the link to the deployment types when nothing needs discarding", () => {
    const { clickAndReportPrevented } = setup({ needsConfirmation: false });
    const backLink = screen.getByRole("link", { name: "Back to deployment types" });

    const wasPrevented = clickAndReportPrevented(backLink);

    expect(wasPrevented).toBe(false);
    expect(backLink).toHaveAttribute("href", UrlService.newDeployment());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    [
      "a gallery template returns to its page",
      { templateId: "akash-network-awesome-akash-comfyui" },
      "Back to template",
      "/templates/akash-network-awesome-akash-comfyui"
    ],
    ["a user template returns to its page", { userTemplateId: "user-template-1" }, "Back to template", "/template/user-template-1"],
    ["hello world has no gallery page, so it returns to the deployment types", { templateId: "hello-world" }, "Back to deployment types", "/new-deployment"],
    ["the empty template has no gallery page, so it returns to the deployment types", { templateId: "empty" }, "Back to deployment types", "/new-deployment"]
  ])("%s", (_, intent, label, href) => {
    setup({ needsConfirmation: false, intent });

    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
  });

  it("asks before discarding a pending deployment and names what is lost", () => {
    const { clickAndReportPrevented } = setup({
      needsConfirmation: true,
      deploymentName: "my-app",
      serviceCount: 2,
      placementCount: 1,
      hasBids: true,
      canEditInstead: true
    });

    const wasPrevented = clickAndReportPrevented(screen.getByRole("link", { name: "Back to deployment types" }));

    expect(wasPrevented).toBe(true);
    const dialog = screen.getByRole("dialog", { name: "Leave and discard this deployment?" });
    expect(dialog).toHaveAccessibleDescription("Leaving closes the pending deployment and discards this draft. You'll lose:");
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map(item => item.textContent)
    ).toEqual(["my-app, with 2 services across 1 placement", "The bids providers have sent so far"]);
    expect(within(dialog).getByText("To change the configuration instead, use Edit.")).toBeInTheDocument();
  });

  it.each(["metaKey", "ctrlKey", "shiftKey", "altKey"] as const)(
    "leaves a click with %s to the browser without asking, since opening the destination elsewhere discards nothing",
    modifier => {
      const { clickAndReportPrevented } = setup({ needsConfirmation: true });

      const wasPrevented = clickAndReportPrevented(screen.getByRole("link", { name: "Back to deployment types" }), { [modifier]: true });

      expect(wasPrevented).toBe(false);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
  );

  it("leaves the bids and the Edit hint out when there are none to speak of", () => {
    const { clickAndReportPrevented } = setup({
      needsConfirmation: true,
      deploymentName: "",
      serviceCount: 1,
      placementCount: 2,
      hasBids: false,
      canEditInstead: false
    });

    clickAndReportPrevented(screen.getByRole("link", { name: "Back to deployment types" }));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map(item => item.textContent)
    ).toEqual(["Your deployment, with 1 service across 2 placements"]);
    expect(within(dialog).queryByText("To change the configuration instead, use Edit.")).not.toBeInTheDocument();
  });

  it("keeps configuring when the discard is declined", async () => {
    const { router, onDiscard, clickAndReportPrevented } = setup({ needsConfirmation: true });

    clickAndReportPrevented(screen.getByRole("link", { name: "Back to deployment types" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep configuring" }));

    expect(onDiscard).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("replaces the page with the deployment types after a discard, so browser back never returns to the closed deployment", async () => {
    const { router, onDiscard, clickAndReportPrevented } = setup({ needsConfirmation: true });

    clickAndReportPrevented(screen.getByRole("link", { name: "Back to deployment types" }));
    await userEvent.click(screen.getByRole("button", { name: "Discard and leave" }));

    expect(onDiscard).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(UrlService.newDeployment());
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("replaces the page with the template it started from after a discard", async () => {
    const { router, clickAndReportPrevented } = setup({ needsConfirmation: true, intent: { templateId: "akash-network-awesome-akash-comfyui" } });

    clickAndReportPrevented(screen.getByRole("link", { name: "Back to template" }));
    await userEvent.click(screen.getByRole("button", { name: "Discard and leave" }));

    expect(router.replace).toHaveBeenCalledWith(UrlService.templateDetails("akash-network-awesome-akash-comfyui"));
  });

  it("keeps an onboarded user's discard out of the onboarding analytics", async () => {
    const { analyticsService, clickAndReportPrevented } = setup({ needsConfirmation: true, isOnboarded: true });

    clickAndReportPrevented(screen.getByRole("link", { name: "Back to deployment types" }));
    await userEvent.click(screen.getByRole("button", { name: "Discard and leave" }));

    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  it("keeps an onboarded user's plain leave out of the onboarding analytics", () => {
    const { analyticsService, clickAndReportPrevented } = setup({ needsConfirmation: false, isOnboarded: true });

    clickAndReportPrevented(screen.getByRole("link", { name: "Back to deployment types" }));

    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  describe("when the user has not onboarded yet", () => {
    it.each([
      ["a custom deployment", {}],
      ["hello world", { templateId: "hello-world" }],
      ["a gallery template", { templateId: "akash-network-awesome-akash-comfyui" }],
      ["a user template", { userTemplateId: "user-template-1" }]
    ])("returns to onboarding from %s, which the onboarding gate would otherwise bounce them to", (_, intent) => {
      setup({ needsConfirmation: false, isOnboarded: false, intent });

      expect(screen.getByRole("link", { name: "Back to onboarding" })).toHaveAttribute("href", UrlService.onboardingPicker());
    });

    it("tracks leaving onboarding through the back link when nothing needed discarding", () => {
      const { analyticsService, clickAndReportPrevented } = setup({ needsConfirmation: false, isOnboarded: false });

      const wasPrevented = clickAndReportPrevented(screen.getByRole("link", { name: "Back to onboarding" }));

      expect(wasPrevented).toBe(false);
      expect(analyticsService.track).toHaveBeenCalledWith("onboarding_left", { category: "onboarding", control: "back_link", discardedDeployment: false });
    });

    it("asks before discarding a pending deployment, then replaces the page with onboarding and tracks the discard", async () => {
      const { router, onDiscard, analyticsService, clickAndReportPrevented } = setup({ needsConfirmation: true, isOnboarded: false });

      const wasPrevented = clickAndReportPrevented(screen.getByRole("link", { name: "Back to onboarding" }));
      expect(wasPrevented).toBe(true);
      expect(analyticsService.track).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("button", { name: "Discard and leave" }));

      expect(onDiscard).toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalledWith(UrlService.onboardingPicker());
      expect(analyticsService.track).toHaveBeenCalledWith("onboarding_left", { category: "onboarding", control: "back_link", discardedDeployment: true });
    });

    it("tracks nothing when the discard is declined", async () => {
      const { analyticsService, clickAndReportPrevented } = setup({ needsConfirmation: true, isOnboarded: false });

      clickAndReportPrevented(screen.getByRole("link", { name: "Back to onboarding" }));
      await userEvent.click(screen.getByRole("button", { name: "Keep configuring" }));

      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    it("tracks nothing when the link opens elsewhere, since the user is still here", () => {
      const { analyticsService, clickAndReportPrevented } = setup({ needsConfirmation: false, isOnboarded: false });

      clickAndReportPrevented(screen.getByRole("link", { name: "Back to onboarding" }), { metaKey: true });

      expect(analyticsService.track).not.toHaveBeenCalled();
    });
  });

  function setup(input: {
    intent?: ComponentProps<typeof LeaveConfigureButton>["intent"];
    needsConfirmation: boolean;
    deploymentName?: string;
    serviceCount?: number;
    placementCount?: number;
    hasBids?: boolean;
    canEditInstead?: boolean;
    isOnboarded?: boolean;
  }) {
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();
    const onDiscard = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const dependencies: typeof DEPENDENCIES = {
      useRouter: () => router,
      useIsOnboarded: () => input.isOnboarded ?? true,
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService }),
      UrlService
    };

    const { container } = render(
      <LeaveConfigureButton
        intent={input.intent ?? {}}
        needsConfirmation={input.needsConfirmation}
        deploymentName={input.deploymentName ?? "my-app"}
        serviceCount={input.serviceCount ?? 1}
        placementCount={input.placementCount ?? 1}
        hasBids={input.hasBids ?? false}
        canEditInstead={input.canEditInstead ?? false}
        onDiscard={onDiscard}
        dependencies={dependencies}
      />
    );

    const clickAndReportPrevented = (element: HTMLElement, init?: MouseEventInit) => {
      let wasPrevented = false;
      const recordAndStopNavigation = (event: Event) => {
        wasPrevented = event.defaultPrevented;
        event.preventDefault();
      };
      container.addEventListener("click", recordAndStopNavigation);
      fireEvent.click(element, init);
      container.removeEventListener("click", recordAndStopNavigation);
      return wasPrevented;
    };

    return { router, onDiscard, analyticsService, clickAndReportPrevented };
  }
});
