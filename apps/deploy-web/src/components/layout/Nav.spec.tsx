import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES, Nav } from "./Nav";

import { render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe("Nav", () => {
  it("shows the skip onboarding button next to the reduced account menu in minimal mode", () => {
    const { skipOnboardingButton, accountMenu } = setup({ minimal: true });

    expect(skipOnboardingButton.mock.calls[0][0]).toMatchObject({ source: "auto_deploy" });
    expect(accountMenu.mock.calls[0][0]).toMatchObject({ minimal: true });
  });

  it("does not show the skip onboarding button in the full chrome", () => {
    const { skipOnboardingButton } = setup({ minimal: false });

    expect(skipOnboardingButton).not.toHaveBeenCalled();
  });

  function setup(input: { minimal?: boolean }) {
    const skipOnboardingButton = vi.fn<typeof DEPENDENCIES.SkipOnboardingButton>(() => <></>);
    const accountMenu = vi.fn<typeof DEPENDENCIES.AccountMenu>(() => <></>);

    const dependencies = MockComponents(DEPENDENCIES, {
      SkipOnboardingButton: skipOnboardingButton,
      AccountMenu: accountMenu
    });

    render(<Nav isMobileOpen={false} handleDrawerToggle={vi.fn()} minimal={input.minimal} dependencies={dependencies} />);

    return { skipOnboardingButton, accountMenu };
  }
});
