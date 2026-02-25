import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EmailVerificationStep } from "./EmailVerificationStep";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(EmailVerificationStep.name, () => {
  it("renders 6 digit inputs", () => {
    setup();

    const inputs = screen.queryAllByRole("textbox");
    expect(inputs).toHaveLength(6);
  });

  it("renders verification title", () => {
    setup();

    expect(screen.queryByText("Email Verification")).toBeInTheDocument();
  });

  it("renders code prompt text", () => {
    setup();

    expect(screen.queryByText("We've sent a 6-digit verification code to your email address.")).toBeInTheDocument();
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

    const buttons = screen.queryAllByRole("button");
    const resendButton = buttons.find(b => b.textContent?.includes("Resend Code"));
    expect(resendButton).toBeDisabled();
  });

  it("disables resend button while resending", () => {
    setup({ isResending: true });

    const buttons = screen.queryAllByRole("button");
    const resendButton = buttons.find(b => b.textContent?.includes("Sending"));
    expect(resendButton).toBeDisabled();
  });

  it("calls onResendCode when resend button is clicked", () => {
    const { onResendCode } = setup();

    const buttons = screen.queryAllByRole("button");
    const resendButton = buttons.find(b => b.textContent?.includes("Resend Code"))!;
    fireEvent.click(resendButton);

    expect(onResendCode).toHaveBeenCalled();
  });

  it("displays verify error alert", () => {
    setup({ verifyError: "Invalid verification code" });

    expect(screen.queryByText("Invalid verification code")).toBeInTheDocument();
  });

  it("displays verifying state", () => {
    setup({ isVerifying: true });

    expect(screen.queryByText("Verifying...")).toBeInTheDocument();
    const inputs = screen.queryAllByRole("textbox");
    for (const input of inputs) {
      expect(input).toBeDisabled();
    }
  });

  it("calls onVerifyCode when all 6 digits are entered", async () => {
    const { onVerifyCode } = setup();

    const inputs = screen.queryAllByRole("textbox");
    const user = userEvent.setup();

    for (let i = 0; i < 6; i++) {
      await user.click(inputs[i]);
      await user.keyboard((i + 1).toString());
    }

    expect(onVerifyCode).toHaveBeenCalledWith("123456");
  });

  it("calls onVerifyCode when OTP autofill injects all 6 digits into first input", () => {
    const { onVerifyCode } = setup();

    const inputs = screen.queryAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "654321" } });

    expect(onVerifyCode).toHaveBeenCalledWith("654321");
  });

  function setup(
    input: {
      isResending?: boolean;
      isVerifying?: boolean;
      cooldownSeconds?: number;
      verifyError?: string | null;
      onResendCode?: () => void;
      onVerifyCode?: (code: string) => void;
    } = {}
  ) {
    const onResendCode = input.onResendCode ?? vi.fn();
    const onVerifyCode = input.onVerifyCode ?? vi.fn();

    render(
      <EmailVerificationStep
        isResending={input.isResending ?? false}
        isVerifying={input.isVerifying ?? false}
        cooldownSeconds={input.cooldownSeconds ?? 0}
        verifyError={input.verifyError ?? null}
        onResendCode={onResendCode}
        onVerifyCode={onVerifyCode}
      />
    );

    return { onResendCode, onVerifyCode };
  }
});
