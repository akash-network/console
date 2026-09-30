import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { UrlService } from "@src/utils/urlUtils";
import { ConfigureDeploymentBackButton, DEPENDENCIES } from "./ConfigureDeploymentBackButton";

import { fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe("ConfigureDeploymentBackButton", () => {
  it("navigates back when the user has navigated within the app", () => {
    const { router } = setup({ hasInAppHistory: true });

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("falls back to the onboarding picker when the page is the session entry point", () => {
    const { router } = setup({ hasInAppHistory: false });

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(router.push).toHaveBeenCalledWith(UrlService.onboardingPicker());
    expect(router.back).not.toHaveBeenCalled();
  });

  it("is disabled while a deployment is being created", () => {
    setup({ hasInAppHistory: true, isDeploymentCreating: true });

    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
  });

  it("is enabled when no deployment is being created", () => {
    setup({ hasInAppHistory: true });

    expect(screen.getByRole("button", { name: /back/i })).toBeEnabled();
  });

  function setup(input: { hasInAppHistory: boolean; isDeploymentCreating?: boolean }) {
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();
    render(
      <ConfigureDeploymentBackButton
        dependencies={MockComponents(DEPENDENCIES, {
          useRouter: () => router,
          useHasInAppHistory: () => input.hasInAppHistory,
          useIsDeploymentCreating: () => input.isDeploymentCreating ?? false,
          UrlService
        })}
      />
    );
    return { router };
  }
});
