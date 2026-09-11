import { describe, expect, it, vi } from "vitest";

import { MAX_DEPLOYMENT_NAME_LENGTH } from "@src/config/deploy.config";
import { DeploymentNameField } from "./DeploymentNameField";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("DeploymentNameField", () => {
  it("disables the input while locked", () => {
    setup({ disabled: true });

    expect(screen.getByRole("textbox", { name: "Deployment name" })).toBeDisabled();
  });

  it("caps the name at the length the api accepts, so a long name cannot fail the whole create", () => {
    setup({ value: "" });

    expect(screen.getByRole("textbox", { name: "Deployment name" })).toHaveAttribute("maxlength", String(MAX_DEPLOYMENT_NAME_LENGTH));
  });

  it("reports typed changes", async () => {
    const { onChange } = setup({ value: "" });

    await userEvent.type(screen.getByRole("textbox", { name: "Deployment name" }), "a");

    expect(onChange).toHaveBeenCalledWith("a");
  });

  function setup(input: { value?: string; disabled?: boolean }) {
    const onChange = vi.fn();
    render(<DeploymentNameField value={input.value ?? ""} disabled={input.disabled} onChange={onChange} />);
    return { onChange };
  }
});
