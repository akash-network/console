import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { UrlService } from "@src/utils/urlUtils";
import { ConfigureDeploymentBackButton, DEPENDENCIES } from "./ConfigureDeploymentBackButton";

import { fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe("ConfigureDeploymentBackButton", () => {
  it("navigates back when there is a previous route", () => {
    const { router } = setup({ previousRoute: "/onboarding" });

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("falls back to the onboarding picker when there is no previous route", () => {
    const { router } = setup({ previousRoute: null });

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(router.push).toHaveBeenCalledWith(UrlService.onboardingPicker());
    expect(router.back).not.toHaveBeenCalled();
  });

  function setup(input: { previousRoute: string | null }) {
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();
    render(
      <ConfigureDeploymentBackButton
        dependencies={MockComponents(DEPENDENCIES, {
          useRouter: () => router,
          usePreviousRoute: () => input.previousRoute,
          UrlService
        })}
      />
    );
    return { router };
  }
});
