import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EmailVerificationStep } from "./EmailVerificationStep";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("renders resend button as 'Resend Code' when idle", () => {
    setup();

    expect(screen.queryByText("Resend Code")).toBeInTheDocument();
  });

  it("calls sendCode when resend button is clicked", async () => {
    const { sendCode } = setup();

    const buttons = screen.queryAllByRole("button");
    const resendButton = buttons.find(b => b.textContent?.includes("Resend Code"))!;
    await act(async () => {
      fireEvent.click(resendButton);
    });

    expect(sendCode).toHaveBeenCalled();
  });

  it("shows success notification after resend", async () => {
    const { mockNotificator } = setup();

    const buttons = screen.queryAllByRole("button");
    const resendButton = buttons.find(b => b.textContent?.includes("Resend Code"))!;
    await act(async () => {
      fireEvent.click(resendButton);
    });

    expect(mockNotificator.success).toHaveBeenCalledWith("Verification code sent. Please check your email for the 6-digit code.");
  });

  it("shows error notification when resend fails", async () => {
    const sendCode = vi.fn().mockRejectedValue(new Error("Please wait before requesting a new verification code."));
    const { mockNotificator } = setup({ sendCode });

    const buttons = screen.queryAllByRole("button");
    const resendButton = buttons.find(b => b.textContent?.includes("Resend Code"))!;
    await act(async () => {
      fireEvent.click(resendButton);
    });

    expect(mockNotificator.error).toHaveBeenCalledWith("Please wait before requesting a new verification code.");
  });

  it("starts cooldown after successful resend", async () => {
    setup();

    const buttons = screen.queryAllByRole("button");
    const resendButton = buttons.find(b => b.textContent?.includes("Resend Code"))!;
    await act(async () => {
      fireEvent.click(resendButton);
    });

    await waitFor(() => {
      expect(screen.queryByText("Resend Code (60s)")).toBeInTheDocument();
    });
  });

  it("calls verifyCode when all 6 digits are entered", async () => {
    const { verifyCode } = setup();

    const inputs = screen.queryAllByRole("textbox");
    const user = userEvent.setup();

    for (let i = 0; i < 6; i++) {
      await user.click(inputs[i]);
      await user.keyboard((i + 1).toString());
    }

    expect(verifyCode).toHaveBeenCalledWith("123456");
  });

  it("calls verifyCode when OTP autofill injects all 6 digits into first input", async () => {
    const { verifyCode } = setup();

    const inputs = screen.queryAllByRole("textbox");
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: "654321" } });
    });

    expect(verifyCode).toHaveBeenCalledWith("654321");
  });

  it("shows error notification when verify fails", async () => {
    const verifyCode = vi.fn().mockRejectedValue(new Error("Invalid verification code"));
    const { mockNotificator } = setup({ verifyCode });

    const inputs = screen.queryAllByRole("textbox");
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: "654321" } });
    });

    await waitFor(() => {
      expect(mockNotificator.error).toHaveBeenCalledWith("Invalid verification code");
    });
  });

  function setup(
    input: {
      sendCode?: () => Promise<void>;
      verifyCode?: (code: string) => Promise<void>;
    } = {}
  ) {
    const sendCode = input.sendCode ?? vi.fn().mockResolvedValue(undefined);
    const verifyCode = input.verifyCode ?? vi.fn().mockResolvedValue(undefined);
    const mockNotificator = { success: vi.fn(), error: vi.fn() };
    const mockExtractErrorMessage = vi.fn((error: unknown) => (error instanceof Error ? error.message : "An error occurred. Please try again."));

    const dependencies = {
      useNotificator: () => mockNotificator,
      extractErrorMessage: mockExtractErrorMessage
    };

    render(<EmailVerificationStep sendCode={sendCode} verifyCode={verifyCode} dependencies={dependencies} />);

    return { sendCode, verifyCode, mockNotificator, mockExtractErrorMessage };
  }
});
