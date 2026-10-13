import type { MouseEvent } from "react";
import React from "react";
import type { AuthHttpService } from "@akashnetwork/http-sdk";
import type { usePopup } from "@akashnetwork/ui/context";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { DEPENDENCIES } from "./useEmailVerificationRequiredEventHandler";
import { useEmailVerificationRequiredEventHandler, useRunWhenEmailVerified } from "./useEmailVerificationRequiredEventHandler";

import { act, renderHook, waitFor } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(useEmailVerificationRequiredEventHandler.name, () => {
  describe(useRunWhenEmailVerified.name, () => {
    it("runs the action right away for a verified email", () => {
      const { result, requireAction } = setup({ isEmailVerified: true, hook: useRunWhenEmailVerified });
      const proceed = vi.fn();

      result.current("Verify your email first.", proceed);

      expect(proceed).toHaveBeenCalled();
      expect(requireAction).not.toHaveBeenCalled();
    });

    it("asks to verify the email instead of running the action", () => {
      const { result, requireAction } = setup({ isEmailVerified: false, hook: useRunWhenEmailVerified });
      const proceed = vi.fn();

      result.current("Verify your email first.", proceed);

      expect(proceed).not.toHaveBeenCalled();
      expect(requireAction).toHaveBeenCalledWith(expect.objectContaining({ message: "Verify your email first." }));
    });

    it("sends a verification code from the prompt and confirms it", async () => {
      const { result, auth, analyticsService, enqueueSnackbar, sendCode } = setup({ isEmailVerified: false, hook: useRunWhenEmailVerified });
      result.current("Verify your email first.", vi.fn());
      auth.sendVerificationCode.mockResolvedValue({ data: { codeSentAt: "2026-10-12T00:00:00Z" } });

      const close = await act(() => sendCode());

      expect(analyticsService.track).toHaveBeenCalledWith("send_verification_code_btn_clk", "Amplitude");
      expect(auth.sendVerificationCode).toHaveBeenCalled();
      await waitFor(() => expect(close).toHaveBeenCalled());
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            title: "Verification code sent",
            subTitle: "Please check your email for the 6-digit code and verify in the onboarding page",
            iconVariant: "success"
          })
        }),
        { variant: "success" }
      );
    });

    it("tells the user when the code could not be sent", async () => {
      const { result, auth, enqueueSnackbar, sendCode } = setup({ isEmailVerified: false, hook: useRunWhenEmailVerified });
      result.current("Verify your email first.", vi.fn());
      auth.sendVerificationCode.mockRejectedValue(new Error("network"));

      const close = await act(() => sendCode());

      await waitFor(() => expect(close).toHaveBeenCalled());
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({ title: "Failed to send code", subTitle: "Please try again later or contact support", iconVariant: "error" })
        }),
        { variant: "error" }
      );
    });

    it("offers a single left-aligned large button in the prompt", () => {
      const { result, promptActions } = setup({ isEmailVerified: false, hook: useRunWhenEmailVerified });

      result.current("Verify your email first.", vi.fn());

      expect(promptActions()).toEqual([expect.objectContaining({ label: "Send verification code", side: "left", size: "lg" })]);
    });
  });

  describe("when wrapping an event handler", () => {
    it("hands back the handler unchanged for a verified email", () => {
      const { result } = setup({ isEmailVerified: true, hook: useEmailVerificationRequiredEventHandler });
      const handler = vi.fn();

      expect(result.current("Verify your email first.")(handler)).toBe(handler);
    });

    it("stops the event and asks to verify the email otherwise", () => {
      const { result, requireAction } = setup({ isEmailVerified: false, hook: useEmailVerificationRequiredEventHandler });
      const handler = vi.fn();
      const event = mock<MouseEvent>();

      result.current("Verify your email first.")(handler)(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
      expect(requireAction).toHaveBeenCalledWith(expect.objectContaining({ message: "Verify your email first." }));
    });
  });

  function setup<T>(input: { isEmailVerified: boolean; hook: (dependencies: typeof DEPENDENCIES) => T }) {
    const requireAction = vi.fn<ReturnType<typeof usePopup>["requireAction"]>(async () => undefined);
    const enqueueSnackbar = vi.fn();
    const auth = mock<AuthHttpService>();
    const analyticsService = mock<AnalyticsService>();

    const dependencies: typeof DEPENDENCIES = {
      usePopup: () => mock<ReturnType<typeof usePopup>>({ requireAction }),
      useCustomUser: () => mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>({ user: { emailVerified: input.isEmailVerified } }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };

    const { result } = renderHook(() => input.hook(dependencies), {
      wrapper: ({ children }) => (
        <TestContainerProvider services={{ auth: () => auth, analyticsService: () => analyticsService }}>{children}</TestContainerProvider>
      )
    });

    const promptActions = () => {
      const { actions } = requireAction.mock.calls[0][0];
      return typeof actions === "function" ? actions({ close: vi.fn() }) : actions;
    };

    const sendCode = async () => {
      const close = vi.fn();
      const { actions } = requireAction.mock.calls[0][0];
      const [sendCodeAction] = typeof actions === "function" ? actions({ close }) : actions;
      sendCodeAction.onClick?.(mock<MouseEvent<HTMLButtonElement>>());
      return close;
    };

    return { result, requireAction, enqueueSnackbar, auth, analyticsService, promptActions, sendCode };
  }
});
