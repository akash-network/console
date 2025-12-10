import "@testing-library/jest-dom";

import type { ComponentProps } from "react";
import { mock } from "jest-mock-extended";
import type { NextRouter } from "next/router";

import { TestContainerProvider } from "../../../../tests/unit/TestContainerProvider";
import { SignInForm, type SignInFormValues } from "./SignInForm";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(SignInForm.name, () => {
  it("submits form values when valid credentials are provided", async () => {
    const { onSubmit } = setup();

    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({ email: "alice@example.com", password: "password123" });
    });
  });

  it("disables submit button and renders spinner while loading", () => {
    const { onSubmit, props, rerender } = setup();

    rerender(<SignInForm {...props} isLoading={true} />);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Log in")).not.toBeInTheDocument();
  });

  it("navigates backward when browser history has entries", () => {
    const { router } = setup({ historyLength: 2 });
    const goBackButton = screen.getByRole("button", { name: "Go Back" });

    fireEvent.click(goBackButton);

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("validates form when submitted", async () => {
    const { onSubmit } = setup();

    await userEvent.type(screen.getByLabelText("Email"), "test");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
  });

  type SignInFormProps = ComponentProps<typeof SignInForm>;
  type SetupOptions = {
    historyLength?: number;
    props?: Partial<SignInFormProps>;
    routerOverrides?: Partial<NextRouter>;
  };

  function setup(input: SetupOptions = {}) {
    const router = mock<NextRouter>();
    const onSubmit = input.props?.onSubmit ?? jest.fn<void, [SignInFormValues]>();
    const props: SignInFormProps = {
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
        <SignInForm {...props} />
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
