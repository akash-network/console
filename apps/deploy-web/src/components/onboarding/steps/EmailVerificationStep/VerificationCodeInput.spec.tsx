import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { VerificationCodeInputRef } from "./VerificationCodeInput";
import { VerificationCodeInput } from "./VerificationCodeInput";

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(VerificationCodeInput.name, () => {
  it("renders 6 digit inputs", () => {
    setup();

    const inputs = screen.queryAllByRole("textbox");
    expect(inputs).toHaveLength(6);
  });

  it("renders inputs with correct aria labels", () => {
    setup();

    for (let i = 1; i <= 6; i++) {
      expect(screen.queryByLabelText(`Verification code digit ${i}`)).toBeInTheDocument();
    }
  });

  it("sets autoComplete='one-time-code' on first input only", () => {
    setup();

    const inputs = screen.queryAllByRole("textbox");
    expect(inputs[0]).toHaveAttribute("autoComplete", "one-time-code");
    expect(inputs[1]).toHaveAttribute("autoComplete", "off");
  });

  it("calls onComplete when all 6 digits are entered", async () => {
    const { onComplete } = setup();
    const user = userEvent.setup();

    const inputs = screen.queryAllByRole("textbox");
    for (let i = 0; i < 6; i++) {
      await user.click(inputs[i]);
      await user.keyboard((i + 1).toString());
    }

    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("calls onComplete when OTP autofill injects all 6 digits into first input", async () => {
    const { onComplete } = setup();

    const inputs = screen.queryAllByRole("textbox");
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: "654321" } });
    });

    expect(onComplete).toHaveBeenCalledWith("654321");
  });

  it("does not call onComplete for non-numeric input", async () => {
    const { onComplete } = setup();
    const user = userEvent.setup();

    const inputs = screen.queryAllByRole("textbox");
    await user.click(inputs[0]);
    await user.keyboard("abcdef");

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("disables all inputs when disabled prop is true", () => {
    setup({ disabled: true });

    const inputs = screen.queryAllByRole("textbox");
    inputs.forEach(input => {
      expect(input).toBeDisabled();
    });
  });

  it("resets digits when reset is called via ref", async () => {
    const ref = React.createRef<VerificationCodeInputRef>();
    const { onComplete } = setup({ ref });

    const inputs = screen.queryAllByRole("textbox");
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: "654321" } });
    });

    expect(onComplete).toHaveBeenCalledWith("654321");
    onComplete.mockClear();

    act(() => {
      ref.current?.reset();
    });

    inputs.forEach(input => {
      expect(input).toHaveValue("");
    });
  });

  it("allows re-submitting the same code after reset", async () => {
    const ref = React.createRef<VerificationCodeInputRef>();
    const { onComplete } = setup({ ref });

    const inputs = screen.queryAllByRole("textbox");
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: "654321" } });
    });

    expect(onComplete).toHaveBeenCalledWith("654321");
    onComplete.mockClear();

    act(() => {
      ref.current?.reset();
    });

    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: "654321" } });
    });

    expect(onComplete).toHaveBeenCalledWith("654321");
  });

  function setup(input: { onComplete?: (code: string) => void; disabled?: boolean; ref?: React.Ref<VerificationCodeInputRef> } = {}) {
    const onComplete = (input.onComplete as ReturnType<typeof vi.fn>) ?? vi.fn();

    render(<VerificationCodeInput ref={input.ref ?? null} onComplete={onComplete} disabled={input.disabled} />);

    return { onComplete };
  }
});
