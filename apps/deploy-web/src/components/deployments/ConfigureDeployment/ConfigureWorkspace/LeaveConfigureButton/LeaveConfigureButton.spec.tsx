import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./LeaveConfigureButton";
import { LeaveConfigureButton } from "./LeaveConfigureButton";

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(LeaveConfigureButton.name, () => {
  it("follows the link to the deployments list when nothing needs discarding", () => {
    const { clickAndReportPrevented } = setup({ needsConfirmation: false });
    const backLink = screen.getByRole("link", { name: "Back to deployments" });

    const wasPrevented = clickAndReportPrevented(backLink);

    expect(wasPrevented).toBe(false);
    expect(backLink).toHaveAttribute("href", UrlService.deploymentList());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

    const wasPrevented = clickAndReportPrevented(screen.getByRole("link", { name: "Back to deployments" }));

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
    "leaves a click with %s to the browser without asking, since opening the list elsewhere discards nothing",
    modifier => {
      const { clickAndReportPrevented } = setup({ needsConfirmation: true });

      const wasPrevented = clickAndReportPrevented(screen.getByRole("link", { name: "Back to deployments" }), { [modifier]: true });

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

    clickAndReportPrevented(screen.getByRole("link", { name: "Back to deployments" }));

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

    clickAndReportPrevented(screen.getByRole("link", { name: "Back to deployments" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep configuring" }));

    expect(onDiscard).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("replaces the page with the deployments list after a discard, so browser back never returns to the closed deployment", async () => {
    const { router, onDiscard, clickAndReportPrevented } = setup({ needsConfirmation: true });

    clickAndReportPrevented(screen.getByRole("link", { name: "Back to deployments" }));
    await userEvent.click(screen.getByRole("button", { name: "Discard and leave" }));

    expect(onDiscard).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(UrlService.deploymentList());
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  function setup(input: {
    needsConfirmation: boolean;
    deploymentName?: string;
    serviceCount?: number;
    placementCount?: number;
    hasBids?: boolean;
    canEditInstead?: boolean;
  }) {
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();
    const onDiscard = vi.fn();
    const dependencies: typeof DEPENDENCIES = { useRouter: () => router, UrlService };

    const { container } = render(
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

    return { router, onDiscard, clickAndReportPrevented };
  }
});
