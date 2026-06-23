import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { QuantityStepper } from "./quantity-stepper";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(QuantityStepper.name, () => {
  it("renders the current value", () => {
    setup({ value: 3 });
    expect(screen.getByLabelText("GPU count")).toHaveValue(3);
  });

  it("increments by the step on plus", async () => {
    const { onChange } = setup({ value: 1, step: 2 });

    await userEvent.click(screen.getByRole("button", { name: "Increase GPU count" }));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("decrements by the step on minus", async () => {
    const { onChange } = setup({ value: 4 });

    await userEvent.click(screen.getByRole("button", { name: "Decrease GPU count" }));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("clamps to max", async () => {
    const { onChange } = setup({ value: 5, max: 5 });

    await userEvent.click(screen.getByRole("button", { name: "Increase GPU count" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Increase GPU count" })).toBeDisabled();
  });

  it("clamps to min", async () => {
    const { onChange } = setup({ value: 0, min: 0 });

    await userEvent.click(screen.getByRole("button", { name: "Decrease GPU count" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Decrease GPU count" })).toBeDisabled();
  });

  it("disables both buttons when disabled", () => {
    setup({ value: 2, disabled: true });

    expect(screen.getByRole("button", { name: "Increase GPU count" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decrease GPU count" })).toBeDisabled();
  });

  it("disables the input when disabled", () => {
    setup({ value: 2, disabled: true });

    expect(screen.getByLabelText("GPU count")).toBeDisabled();
  });

  it("associates descriptions with the value input", () => {
    setup({ value: 2, describedBy: "gpu-error" });

    expect(screen.getByLabelText("GPU count")).toHaveAttribute("aria-describedby", "gpu-error");
  });

  it("commits a typed value", async () => {
    const { onChange } = setup({ value: 1, min: 1, max: 20 });
    const input = screen.getByLabelText("GPU count");

    await userEvent.clear(input);
    await userEvent.type(input, "5");

    expect(onChange).toHaveBeenLastCalledWith(5);
    expect(input).toHaveValue(5);
  });

  it("clamps a typed value to max immediately", async () => {
    const { onChange } = setup({ value: 1, min: 1, max: 20 });
    const input = screen.getByLabelText("GPU count");

    await userEvent.clear(input);
    await userEvent.type(input, "99");

    expect(onChange).toHaveBeenLastCalledWith(20);
    expect(input).toHaveValue(20);
  });

  it("clamps to min on blur when typed below the minimum", async () => {
    const { onChange } = setup({ value: 5, min: 2, max: 20 });
    const input = screen.getByLabelText("GPU count");

    await userEvent.clear(input);
    await userEvent.type(input, "1");
    await userEvent.tab();

    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(input).toHaveValue(2);
  });

  it("resets to min on blur when cleared", async () => {
    const { onChange } = setup({ value: 5, min: 2, max: 20 });
    const input = screen.getByLabelText("GPU count");

    await userEvent.clear(input);
    await userEvent.tab();

    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(input).toHaveValue(2);
  });

  it("lets the field be cleared while editing", async () => {
    setup({ value: 5, min: 2, max: 20 });
    const input = screen.getByLabelText("GPU count");

    await userEvent.clear(input);

    expect(input).toHaveValue(null);
  });

  function setup(input: { value: number; min?: number; max?: number; step?: number; disabled?: boolean; describedBy?: string }) {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState(input.value);
      return (
        <QuantityStepper
          label="GPU count"
          value={value}
          min={input.min}
          max={input.max}
          step={input.step}
          disabled={input.disabled}
          aria-describedby={input.describedBy}
          onChange={next => {
            onChange(next);
            setValue(next);
          }}
        />
      );
    }
    render(<Harness />);
    return { onChange };
  }
});
