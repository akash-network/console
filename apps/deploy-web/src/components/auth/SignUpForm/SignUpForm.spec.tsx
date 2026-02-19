import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES, SignUpForm, type SignUpFormValues } from "./SignUpForm";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(SignUpForm.name, () => {
  it("submits form values when valid data is provided", async () => {
    const { onSubmit } = setup();

    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Password1!");
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: /I have read and agree to Terms of Services/i
      })
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({
        email: "jane@example.com",
        password: "Password1!",
        termsAndConditions: true
      });
    });
  });

  it("disables submit button and renders spinner while loading", () => {
    const { rerender } = setup();

    rerender({ isLoading: true });

    expect(screen.queryByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Sign up")).not.toBeInTheDocument();
  });

  it("navigates back to the previous page when 'Go Back' button is clicked", async () => {
    const { goBack } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Go Back" }));

    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it("validates form inputs when submitted", async () => {
    const { onSubmit } = setup();

    await userEvent.type(screen.getByLabelText("Email"), "invalid");
    await userEvent.type(screen.getByLabelText("Password"), "Password1!");
    await userEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByText("Invalid email")).toBeInTheDocument();
    expect(screen.queryByText("You must accept the terms and conditions")).toBeInTheDocument();
  });

  function setup(input: Partial<ComponentProps<typeof SignUpForm>> = {}) {
    const goBack = vi.fn();
    const onSubmit = input?.onSubmit ?? vi.fn<void, [SignUpFormValues]>();
    const props: ComponentProps<typeof SignUpForm> = {
      isLoading: false,
      ...input,
      onSubmit
    };

    const renderResult = render(<SignUpForm {...props} dependencies={{ ...DEPENDENCIES, useBackNav: () => goBack }} />);

    return {
      ...renderResult,
      onSubmit,
      goBack,
      rerender: (newProps?: Partial<ComponentProps<typeof SignUpForm>>) => {
        renderResult.rerender(<SignUpForm {...props} {...newProps} dependencies={{ ...DEPENDENCIES, useBackNav: () => goBack }} />);
      }
    };
  }
});
