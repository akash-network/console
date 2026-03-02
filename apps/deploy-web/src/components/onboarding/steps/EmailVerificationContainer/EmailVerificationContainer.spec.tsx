import React from "react";
import { describe, expect, it, type Mock, vi } from "vitest";

import { EmailVerificationContainer } from "./EmailVerificationContainer";

import { act, render } from "@testing-library/react";

describe(EmailVerificationContainer.name, () => {
  it("renders children with sendCode and verifyCode functions", () => {
    const { child } = setup();

    expect(child).toHaveBeenCalledWith(
      expect.objectContaining({
        sendCode: expect.any(Function),
        verifyCode: expect.any(Function)
      })
    );
  });

  it("auto-advances when email is already verified", () => {
    const mockOnComplete = vi.fn();
    setup({ user: { id: "test-user", emailVerified: true }, onComplete: mockOnComplete });

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it("sendCode delegates to auth.sendVerificationCode", async () => {
    const { child, mockSendVerificationCode } = setup();

    mockSendVerificationCode.mockResolvedValue({});

    const { sendCode } = child.mock.calls[child.mock.calls.length - 1][0];
    await act(async () => {
      await sendCode();
    });

    expect(mockSendVerificationCode).toHaveBeenCalled();
  });

  it("verifyCode delegates to auth.verifyEmailCode then calls checkSession", async () => {
    const { child, mockVerifyEmailCode, mockCheckSession } = setup();
    mockVerifyEmailCode.mockResolvedValue(undefined);
    mockCheckSession.mockResolvedValue(undefined);

    const { verifyCode } = child.mock.calls[0][0];
    await act(async () => {
      await verifyCode("123456");
    });

    expect(mockVerifyEmailCode).toHaveBeenCalledWith("123456");
    expect(mockCheckSession).toHaveBeenCalled();
  });

  it("verifyCode propagates errors", async () => {
    const { child, mockVerifyEmailCode } = setup();
    mockVerifyEmailCode.mockRejectedValue(new Error("Invalid verification code"));

    const { verifyCode } = child.mock.calls[0][0];
    await expect(
      act(async () => {
        await verifyCode("000000");
      })
    ).rejects.toThrow("Invalid verification code");
  });

  it("tracks analytics on auto-advance", () => {
    const mockOnComplete = vi.fn();
    const { mockAnalyticsService } = setup({ user: { id: "test-user", emailVerified: true }, onComplete: mockOnComplete });

    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_email_verified", { category: "onboarding" });
  });

  function setup(input: { user?: { id: string; emailVerified: boolean }; onComplete?: Mock } = {}) {
    const mockSendVerificationCode = vi.fn().mockResolvedValue({});
    const mockVerifyEmailCode = vi.fn();
    const mockCheckSession = vi.fn();
    const mockAnalyticsService = {
      track: vi.fn()
    };

    const mockUseCustomUser = vi.fn().mockReturnValue({
      user: input.user || { id: "test-user", emailVerified: false },
      checkSession: mockCheckSession
    });

    const mockUseServices = vi.fn().mockReturnValue({
      analyticsService: mockAnalyticsService,
      auth: {
        sendVerificationCode: mockSendVerificationCode,
        verifyEmailCode: mockVerifyEmailCode
      }
    });

    const dependencies = {
      useCustomUser: mockUseCustomUser,
      useServices: mockUseServices
    };

    const mockChildren = vi.fn().mockReturnValue(<div>Test</div>);
    const mockOnComplete = input.onComplete || vi.fn();

    render(
      <EmailVerificationContainer onComplete={mockOnComplete} dependencies={dependencies}>
        {mockChildren}
      </EmailVerificationContainer>
    );

    return {
      child: mockChildren,
      mockSendVerificationCode,
      mockVerifyEmailCode,
      mockCheckSession,
      mockAnalyticsService
    };
  }
});
