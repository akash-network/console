import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./LeaveConfigureButton";
import { LeaveConfigureButton } from "./LeaveConfigureButton";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(LeaveConfigureButton.name, () => {
  it("goes back to the previous page when nothing needs discarding", async () => {
    const { router, onDiscard } = setup({ needsConfirmation: false, hasInAppHistory: true });

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(router.back).toHaveBeenCalled();
    expect(onDiscard).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("goes to the deployment picker when the configure screen was opened directly", async () => {
    const { router } = setup({ needsConfirmation: false, hasInAppHistory: false });

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(router.push).toHaveBeenCalledWith("/onboarding-picker");
  });

  it("asks before discarding a pending deployment and names what is lost", async () => {
    setup({ needsConfirmation: true, deploymentName: "my-app", serviceCount: 2, placementCount: 1, hasBids: true, canEditInstead: true });

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    const dialog = screen.getByRole("dialog", { name: "Leave and discard this deployment?" });
    expect(dialog).toHaveAccessibleDescription("Leaving closes the pending deployment and discards this draft. You'll lose:");
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map(item => item.textContent)
    ).toEqual(["my-app, with 2 services across 1 placement", "The bids providers have sent so far"]);
    expect(within(dialog).getByText("To change the configuration instead, use Edit on the left.")).toBeInTheDocument();
  });

  it("leaves the bids and the Edit hint out when there are none to speak of", async () => {
    setup({ needsConfirmation: true, deploymentName: "", serviceCount: 1, placementCount: 2, hasBids: false, canEditInstead: false });

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map(item => item.textContent)
    ).toEqual(["Your deployment, with 1 service across 2 placements"]);
    expect(within(dialog).queryByText(/use Edit on the left/)).not.toBeInTheDocument();
  });

  it("keeps configuring when the discard is declined", async () => {
    const { router, onDiscard } = setup({ needsConfirmation: true });

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep configuring" }));

    expect(onDiscard).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("discards the deployment and goes back", async () => {
    const { router, onDiscard } = setup({ needsConfirmation: true, hasInAppHistory: true });

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Discard and leave" }));

    expect(onDiscard).toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });

  it("replaces the page with the deployment picker after a discard, so browser back never returns to the closed deployment", async () => {
    const { router } = setup({ needsConfirmation: true, hasInAppHistory: false });

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Discard and leave" }));

    expect(router.replace).toHaveBeenCalledWith("/onboarding-picker");
    expect(router.push).not.toHaveBeenCalled();
  });

  function setup(input: {
    needsConfirmation: boolean;
    hasInAppHistory?: boolean;
    deploymentName?: string;
    serviceCount?: number;
    placementCount?: number;
    hasBids?: boolean;
    canEditInstead?: boolean;
  }) {
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();
    const onDiscard = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useRouter: () => router,
      useHasInAppHistory: () => input.hasInAppHistory ?? true,
      UrlService: mock<typeof DEPENDENCIES.UrlService>({ onboardingPicker: () => "/onboarding-picker" })
    };

    render(
      <LeaveConfigureButton
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

    return { router, onDiscard };
  }
});
