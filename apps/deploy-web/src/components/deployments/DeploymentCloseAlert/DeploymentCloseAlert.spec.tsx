import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { FCWithChildren } from "@src/types/component";
import { DeploymentCloseAlert } from "./DeploymentCloseAlert";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(DeploymentCloseAlert.name, () => {
  it("renders a checkbox named and described by the alert type", () => {
    setup();

    expect(screen.getByRole("checkbox", { name: "Deployment Closed" })).toHaveAccessibleDescription("When a deployment is closed for any reason.");
  });

  it("reflects the saved value", () => {
    setup({ enabled: true });

    expect(screen.getByRole("checkbox", { name: "Deployment Closed" })).toBeChecked();
  });

  it("toggles the alert in the form when clicked", async () => {
    setup({ enabled: false });

    await userEvent.click(screen.getByRole("checkbox", { name: "Deployment Closed" }));

    expect(screen.getByRole("checkbox", { name: "Deployment Closed" })).toBeChecked();
    expect(screen.getByTestId("enabled-value")).toHaveTextContent("true");
  });

  it("toggles the alert when its label is clicked", async () => {
    setup({ enabled: true });

    await userEvent.click(screen.getByText("Deployment Closed"));

    expect(screen.getByTestId("enabled-value")).toHaveTextContent("false");
  });

  it("locks the checkbox when disabled", async () => {
    setup({ enabled: false, disabled: true });

    await userEvent.click(screen.getByText("Deployment Closed"));

    expect(screen.getByRole("checkbox", { name: "Deployment Closed" })).toBeDisabled();
    expect(screen.getByTestId("enabled-value")).toHaveTextContent("false");
    expect(screen.getByText("Deployment Closed")).toHaveClass("cursor-not-allowed");
  });

  it("shows a pointer on the label when editable", () => {
    setup();

    expect(screen.getByText("Deployment Closed")).toHaveClass("cursor-pointer");
    expect(screen.getByText("Deployment Closed")).not.toHaveClass("cursor-not-allowed");
  });

  function setup(input: { enabled?: boolean; disabled?: boolean } = {}) {
    const EnabledValue = () => {
      const { watch } = useFormContext();
      return <output data-testid="enabled-value">{String(watch("deploymentClosed.enabled"))}</output>;
    };
    const Wrapper: FCWithChildren = ({ children }) => {
      const methods = useForm({ defaultValues: { deploymentClosed: { enabled: input.enabled ?? false } } });
      return <FormProvider {...methods}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <DeploymentCloseAlert disabled={input.disabled} />
        <EnabledValue />
      </Wrapper>
    );
  }
});
