import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm, type ForgotPasswordFormValues } from "./ForgotPasswordForm";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ForgotPasswordForm.name, () => {
  it("submits form with valid email", async () => {
    const { onSubmit } = setup();

    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset email" }));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({ email: "alice@example.com" });
    });
  });

  it("validates email when submitted with invalid email", async () => {
    const { onSubmit } = setup();

    await userEvent.type(screen.getByLabelText("Email"), "invalid-email");
    await userEvent.click(screen.getByRole("button", { name: "Send reset email" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByText("Invalid email")).toBeInTheDocument();
  });

  it("validates email when submitted with empty email", async () => {
    const { onSubmit } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Send reset email" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Invalid email/i)).toBeInTheDocument();
  });

  it("pre-fills email input when `defaultEmail` is provided", () => {
    setup({ defaultEmail: "bob@example.com" });

    expect(screen.getByLabelText("Email")).toHaveValue("bob@example.com");
  });

  it("calls `onGoBack` when go back button is clicked", async () => {
    const { onGoBack } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Go Back to Log in" }));

    expect(onGoBack).toHaveBeenCalledTimes(1);
  });

  it("disables submit button and shows spinner when status is pending", () => {
    const { props, rerender } = setup();

    rerender(<ForgotPasswordForm {...props} status="pending" />);

    expect(screen.getByRole("button", { name: /send reset email/i })).toBeDisabled();
    expect(screen.queryByRole("status")).toBeInTheDocument();
  });

  it("displays success message when status prop is `success`", () => {
    setup({ status: "success" });

    expect(screen.getByText(/Check your email for password reset instructions/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go Back to Log in" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send reset email" })).not.toBeInTheDocument();
  });

  it("maintains email value when rerendered with different status", async () => {
    const { props, rerender } = setup({});

    await userEvent.type(screen.getByLabelText("Email"), "test@example.com");

    rerender(<ForgotPasswordForm {...props} status="pending" />);

    expect(screen.getByLabelText("Email")).toHaveValue("test@example.com");
  });

  function setup(input: Partial<ComponentProps<typeof ForgotPasswordForm>> = {}) {
    const onSubmit = input.onSubmit ?? vi.fn<void, [ForgotPasswordFormValues]>();
    const onGoBack = input.onGoBack ?? vi.fn<void, []>();
    const props: ComponentProps<typeof ForgotPasswordForm> = {
      status: "idle",
      ...input,
      onSubmit,
      onGoBack
    };

    const renderResult = render(<ForgotPasswordForm {...props} />);

    return {
      ...renderResult,
      onSubmit,
      onGoBack,
      props
    };
  }
});
