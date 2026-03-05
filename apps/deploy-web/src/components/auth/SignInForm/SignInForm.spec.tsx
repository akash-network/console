import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES, SignInForm, type SignInFormValues } from "./SignInForm";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(SignInForm.name, () => {
  it("submits form values when valid credentials are provided", async () => {
    const { onSubmit } = setup();

    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.type(screen.getByLabelText(/Password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({ email: "alice@example.com", password: "password123" });
    });
  });

  it("disables submit button and renders spinner while loading", () => {
    const { onSubmit, rerender } = setup();

    rerender({ isLoading: true });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Log in")).not.toBeInTheDocument();
  });

  it("navigates backward when 'Go Back' button is clicked", () => {
    const { goBack } = setup();
    const goBackButton = screen.getByRole("button", { name: "Go Back" });

    fireEvent.click(goBackButton);

    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it("validates form when submitted", async () => {
    const { onSubmit } = setup();

    await userEvent.type(screen.getByLabelText("Email"), "test");
    await userEvent.type(screen.getByLabelText(/Password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
  });

  function setup(input: Partial<ComponentProps<typeof SignInForm>> = {}) {
    const goBack = vi.fn();
    const onSubmit = input?.onSubmit ?? vi.fn<void, [SignInFormValues]>();
    const props: ComponentProps<typeof SignInForm> = {
      isLoading: false,
      ...input,
      onSubmit
    };

    const renderResult = render(<SignInForm {...props} dependencies={{ ...DEPENDENCIES, useBackNav: () => goBack }} />);

    return {
      ...renderResult,
      onSubmit,
      goBack,
      rerender: (newProps?: Partial<ComponentProps<typeof SignInForm>>) => {
        renderResult.rerender(<SignInForm {...props} {...newProps} dependencies={{ ...DEPENDENCIES, useBackNav: () => goBack }} />);
      }
    };
  }
});
