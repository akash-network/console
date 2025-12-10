import "@testing-library/jest-dom";

import type { ComponentProps } from "react";
import { mock } from "jest-mock-extended";
import type { NextRouter } from "next/router";

import { TestContainerProvider } from "../../../../tests/unit/TestContainerProvider";
import { SignUpForm, type SignUpFormValues } from "./SignUpForm";

import { render, screen, waitFor } from "@testing-library/react";
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

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({
        email: "jane@example.com",
        password: "Password1!",
        termsAndConditions: true
      });
    });
  });

  it("disables submit button and renders spinner while loading", () => {
    const { props, rerender } = setup();

    rerender(<SignUpForm {...props} isLoading={true} />);

    expect(screen.queryByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Sign up")).not.toBeInTheDocument();
  });

  it("navigates backward when browser history has entries", async () => {
    const { router } = setup({ historyLength: 2 });

    await userEvent.click(screen.getByRole("button", { name: "Go Back" }));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("navigates to fallback when browser history is empty", async () => {
    const { router } = setup({ historyLength: 0 });

    await userEvent.click(screen.getByRole("button", { name: "Go Back" }));

    expect(router.push).toHaveBeenCalledWith("/");
    expect(router.back).not.toHaveBeenCalled();
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

  type SignUpFormProps = ComponentProps<typeof SignUpForm>;
  type SetupOptions = {
    historyLength?: number;
    props?: Partial<SignUpFormProps>;
    routerOverrides?: Partial<NextRouter>;
  };

  function setup(input: SetupOptions = {}) {
    const router = mock<NextRouter>(input.routerOverrides);
    const onSubmit = input.props?.onSubmit ?? jest.fn<void, [SignUpFormValues]>();
    const props: SignUpFormProps = {
      isLoading: false,
      ...input.props,
      onSubmit
    };

    const renderResult = render(
      <TestContainerProvider
        services={{
          windowHistory: () =>
            mock<Window["history"]>({
              length: input.historyLength ?? 0
            }),
          router: () => router
        }}
      >
        <SignUpForm {...props} />
      </TestContainerProvider>
    );

    return {
      ...renderResult,
      onSubmit,
      props,
      router
    };
  }
});
