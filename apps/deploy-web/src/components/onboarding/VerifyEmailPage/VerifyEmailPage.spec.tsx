import type { ComponentProps } from "react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { VerifyEmailPage } from "./VerifyEmailPage";

import { render, screen } from "@testing-library/react";

describe(VerifyEmailPage.name, () => {
  it("shows redirect loading text", () => {
    setup();

    expect(screen.queryByText("Redirecting to email verification...")).toBeInTheDocument();
  });

  it("redirects to onboarding with email verification step", () => {
    const { redirect } = setup();

    expect(redirect).toHaveBeenCalledWith("/signup?return-to=%2F");
  });

  function setup(input: { onboardingUrl?: string } = {}) {
    const redirect = vi.fn();

    const dependencies = {
      Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Loading: ({ text }: { text: string }) => <div>{text}</div>,
      NextSeo: () => null,
      UrlService: {
        onboarding: vi.fn(() => input.onboardingUrl ?? "/signup?return-to=%2F")
      },
      redirect
    } as unknown as ComponentProps<typeof VerifyEmailPage>["dependencies"];

    render(<VerifyEmailPage dependencies={dependencies} />);

    return { redirect };
  }
});
