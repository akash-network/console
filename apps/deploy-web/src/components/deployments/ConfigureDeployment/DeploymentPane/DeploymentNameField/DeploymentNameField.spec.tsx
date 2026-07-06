import { describe, expect, it, vi } from "vitest";

import { DeploymentNameField } from "./DeploymentNameField";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("DeploymentNameField", () => {
  it("disables the input while locked", () => {
    setup({ disabled: true });

    expect(screen.getByRole("textbox", { name: "Deployment name" })).toBeDisabled();
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
