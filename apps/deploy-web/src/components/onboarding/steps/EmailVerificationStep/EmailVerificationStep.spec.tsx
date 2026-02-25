import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EmailVerificationStep } from "./EmailVerificationStep";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(EmailVerificationStep.name, () => {
  it("renders 6 digit inputs when not verified", () => {
    setup();

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(6);
  });

  it("renders verification title", () => {
    setup();

    expect(screen.queryByText("Email Verification")).toBeInTheDocument();
  });

  it("renders code prompt text when not verified", () => {
    setup();

    expect(screen.queryByText("We've sent a 6-digit verification code to your email address.")).toBeInTheDocument();
  });

  it("renders success message when verified", () => {
    setup({ isEmailVerified: true });

    expect(screen.queryByText("Your email has been verified successfully.")).toBeInTheDocument();
    expect(screen.queryByText("Email Verified")).toBeInTheDocument();
  });

  it("renders continue button when verified", () => {
    const mockOnContinue = vi.fn();
    setup({ isEmailVerified: true, onContinue: mockOnContinue });

    const continueButton = screen.getByRole("button", { name: "Continue" });
    fireEvent.click(continueButton);

    expect(mockOnContinue).toHaveBeenCalled();
  });

  it("renders resend button with cooldown text", () => {
    setup({ cooldownSeconds: 30 });

    expect(screen.queryByText("Resend Code (30s)")).toBeInTheDocument();
  });

  it("renders resend button as 'Sending...' when resending", () => {
    setup({ isResending: true });

    expect(screen.queryByText("Sending...")).toBeInTheDocument();
  });

  it("renders resend button as 'Resend Code' when idle", () => {
    setup();

    expect(screen.queryByText("Resend Code")).toBeInTheDocument();
  });

  it("disables resend button during cooldown", () => {
    setup({ cooldownSeconds: 10 });

    const buttons = screen.getAllByRole("button");
    const resendButton = buttons.find(b => b.textContent?.includes("Resend Code"));
    expect(resendButton).toBeDisabled();
  });

  it("disables resend button while resending", () => {
    setup({ isResending: true });

    const buttons = screen.getAllByRole("button");
    const resendButton = buttons.find(b => b.textContent?.includes("Sending"));
    expect(resendButton).toBeDisabled();
  });

  it("calls onResendCode when resend button is clicked", () => {
    const mockOnResendCode = vi.fn();
    setup({ onResendCode: mockOnResendCode });

    const buttons = screen.getAllByRole("button");
    const resendButton = buttons.find(b => b.textContent?.includes("Resend Code"))!;
    fireEvent.click(resendButton);

    expect(mockOnResendCode).toHaveBeenCalled();
  });

  it("displays verify error alert", () => {
    setup({ verifyError: "Invalid verification code" });

    expect(screen.queryByText("Invalid verification code")).toBeInTheDocument();
  });

  it("displays verifying state", () => {
    setup({ isVerifying: true });

    expect(screen.queryByText("Verifying...")).toBeInTheDocument();
    const inputs = screen.getAllByRole("textbox");
    inputs.forEach(input => expect(input).toBeDisabled());
  });

  it("calls onVerifyCode when all 6 digits are entered", async () => {
    const mockOnVerifyCode = vi.fn();
    setup({ onVerifyCode: mockOnVerifyCode });

    const inputs = screen.getAllByRole("textbox");
    const user = userEvent.setup();

    for (let i = 0; i < 6; i++) {
      await user.click(inputs[i]);
      await user.keyboard((i + 1).toString());
    }

    expect(mockOnVerifyCode).toHaveBeenCalledWith("123456");
  });

  it("does not render digit inputs when verified", () => {
    setup({ isEmailVerified: true });

    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  function setup(
    input: {
      isEmailVerified?: boolean;
      isResending?: boolean;
      isVerifying?: boolean;
      cooldownSeconds?: number;
      verifyError?: string | null;
      onResendCode?: () => void;
      onVerifyCode?: (code: string) => void;
      onContinue?: () => void;
    } = {}
  ) {
    render(
      <EmailVerificationStep
        isEmailVerified={input.isEmailVerified ?? false}
        isResending={input.isResending ?? false}
        isVerifying={input.isVerifying ?? false}
        cooldownSeconds={input.cooldownSeconds ?? 0}
        verifyError={input.verifyError ?? null}
        onResendCode={input.onResendCode ?? vi.fn()}
        onVerifyCode={input.onVerifyCode ?? vi.fn()}
        onContinue={input.onContinue ?? vi.fn()}
      />
    );
  }
});
