import "@testing-library/jest-dom";

import React from "react";

import { EmailVerificationContainer } from "./EmailVerificationContainer";

import { render } from "@testing-library/react";

// Mock dependencies
const mockUseCustomUser = jest.fn();
const mockUseServices = jest.fn();
const mockUseSnackbar = jest.fn();
const mockSendVerificationEmail = jest.fn();
const mockCheckSession = jest.fn();
const mockEnqueueSnackbar = jest.fn();

jest.mock("@src/hooks/useCustomUser", () => ({
  useCustomUser: () => mockUseCustomUser()
}));

jest.mock("@src/context/ServicesProvider", () => ({
  useServices: () => mockUseServices()
}));

jest.mock("notistack", () => ({
  useSnackbar: () => mockUseSnackbar()
}));

jest.mock("@src/services/http/http-browser.service", () => ({
  services: {
    sendVerificationEmail: mockSendVerificationEmail,
    checkSession: mockCheckSession
  }
}));

describe("EmailVerificationContainer", () => {
  it("should render children with initial state", () => {
    const { child } = setup();

    expect(child).toHaveBeenCalledWith(
      expect.objectContaining({
        isEmailVerified: false,
        isResending: false,
        isChecking: false,
        onResendEmail: expect.any(Function),
        onCheckVerification: expect.any(Function),
        onContinue: expect.any(Function)
      })
    );
  });

  it("should handle resend email success", async () => {
    const { child } = setup();

    mockSendVerificationEmail.mockResolvedValue(undefined);

    const { onResendEmail } = child.mock.calls[0][0];
    await onResendEmail();

    expect(mockSendVerificationEmail).toHaveBeenCalled();
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Verification email sent successfully", {
      variant: "success"
    });
  });

  it("should handle resend email error", async () => {
    const { child } = setup();

    mockSendVerificationEmail.mockRejectedValue(new Error("Failed"));

    const { onResendEmail } = child.mock.calls[0][0];
    await onResendEmail();

    expect(mockSendVerificationEmail).toHaveBeenCalled();
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Failed to send verification email", {
      variant: "error"
    });
  });

  it("should handle check verification success", async () => {
    const { child } = setup();

    mockCheckSession.mockResolvedValue(undefined);

    const { onCheckVerification } = child.mock.calls[0][0];
    await onCheckVerification();

    expect(mockCheckSession).toHaveBeenCalled();
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Email verified successfully", {
      variant: "success"
    });
  });

  it("should handle check verification error", async () => {
    const { child } = setup();

    mockCheckSession.mockRejectedValue(new Error("Failed"));

    const { onCheckVerification } = child.mock.calls[0][0];
    await onCheckVerification();

    expect(mockCheckSession).toHaveBeenCalled();
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Failed to verify email", {
      variant: "error"
    });
  });

  it("should call onComplete when email is verified", () => {
    const mockOnComplete = jest.fn();
    const { child } = setup({
      user: { emailVerified: true },
      onComplete: mockOnComplete
    });

    const { onContinue } = child.mock.calls[0][0];
    onContinue();

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it("should not call onComplete when email is not verified", () => {
    const mockOnComplete = jest.fn();
    const { child } = setup({
      user: { emailVerified: false },
      onComplete: mockOnComplete
    });

    const { onContinue } = child.mock.calls[0][0];
    onContinue();

    expect(mockOnComplete).not.toHaveBeenCalled();
  });

  function setup(input: { user?: any; onComplete?: jest.Mock } = {}) {
    // Reset mocks
    jest.clearAllMocks();

    // Setup default mocks
    mockUseCustomUser.mockReturnValue({
      user: input.user || { emailVerified: false },
      checkSession: mockCheckSession
    });

    mockUseServices.mockReturnValue({
      sendVerificationEmail: mockSendVerificationEmail
    });

    mockUseSnackbar.mockReturnValue({
      enqueueSnackbar: mockEnqueueSnackbar
    });

    const mockChildren = jest.fn().mockReturnValue(<div>Test</div>);
    const mockOnComplete = input.onComplete || jest.fn();

    render(<EmailVerificationContainer onComplete={mockOnComplete}>{mockChildren}</EmailVerificationContainer>);

    return { child: mockChildren };
  }
});
