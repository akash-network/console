import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./OnboardingHeader";
import { OnboardingHeader } from "./OnboardingHeader";

import { render, screen } from "@testing-library/react";

describe(OnboardingHeader.name, () => {
  it("reduces the account menu to its minimal variant", () => {
    const { AccountMenu } = setup({});

    expect(AccountMenu.mock.calls.at(-1)![0]?.minimal).toBe(true);
  });

  it("renders the actions it is given", () => {
    setup({ children: <button>Hackathon? click here</button> });

    expect(screen.getByText("Hackathon? click here")).toBeInTheDocument();
  });

  function setup(input: { children?: ReactNode }) {
    const AccountMenu = vi.fn<typeof DEPENDENCIES.AccountMenu>(() => <div data-testid="account-menu" />);

    render(<OnboardingHeader dependencies={{ AccountMenu }}>{input.children}</OnboardingHeader>);

    return { AccountMenu };
  }
});
