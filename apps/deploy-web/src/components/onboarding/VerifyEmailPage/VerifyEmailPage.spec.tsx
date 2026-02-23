import type { ComponentProps } from "react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { VerifyEmailPage } from "./VerifyEmailPage";

import { act, render, screen } from "@testing-library/react";

describe(VerifyEmailPage.name, () => {
  it("calls verifyEmail with the email from search params", () => {
    const { mockVerifyEmail } = setup({ email: "test@example.com" });

    expect(mockVerifyEmail).toHaveBeenCalledWith("test@example.com");
  });

  it("does not call verifyEmail when email param is missing", () => {
    const { mockVerifyEmail } = setup({ email: null });

    expect(mockVerifyEmail).not.toHaveBeenCalled();
  });

  it("shows loading text when verification is pending", () => {
    setup({ email: "test@example.com", isPending: true });

    expect(screen.queryByText("Just a moment while we finish verifying your email.")).toBeInTheDocument();
  });

  it("shows success message when email is verified", () => {
    const { capturedOnSuccess } = setup({ email: "test@example.com" });

    act(() => capturedOnSuccess?.(true));

    expect(screen.queryByTestId("CheckCircleIcon")).toBeInTheDocument();
  });

  it("shows error message when email verification fails", () => {
    const { capturedOnError } = setup({ email: "test@example.com" });

    act(() => capturedOnError?.());

    expect(screen.queryByText("Your email was not verified. Please try again.")).toBeInTheDocument();
  });

  it("shows error message when isVerified is null", () => {
    setup({ email: "test@example.com" });

    expect(screen.queryByText("Your email was not verified. Please try again.")).toBeInTheDocument();
  });

  function setup(input: { email?: string | null; isPending?: boolean }) {
    const mockVerifyEmail = vi.fn();
    let capturedOnSuccess: ((isVerified: boolean) => void) | undefined;
    let capturedOnError: (() => void) | undefined;

    const mockUseVerifyEmail = vi.fn().mockImplementation((options: { onSuccess?: (v: boolean) => void; onError?: () => void }) => {
      capturedOnSuccess = options.onSuccess;
      capturedOnError = options.onError;
      return { mutate: mockVerifyEmail, isPending: input.isPending || false };
    });

    const mockUseWhen = vi.fn().mockImplementation((condition: unknown, run: () => void) => {
      if (condition) {
        run();
      }
    });

    const dependencies = {
      useSearchParams: vi.fn().mockReturnValue(new URLSearchParams(input.email ? `email=${input.email}` : "")),
      useVerifyEmail: mockUseVerifyEmail,
      useWhen: mockUseWhen,
      Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Loading: ({ text }: { text: string }) => <div>{text}</div>,
      UrlService: {
        onboarding: vi.fn(() => "/signup")
      }
    } as unknown as ComponentProps<typeof VerifyEmailPage>["dependencies"];

    render(<VerifyEmailPage dependencies={dependencies} />);

    return { mockVerifyEmail, capturedOnSuccess, capturedOnError };
  }
});
