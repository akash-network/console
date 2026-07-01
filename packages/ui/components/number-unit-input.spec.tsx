import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { NumberUnitInput } from "./number-unit-input";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const MEMORY_UNITS = [{ suffix: "MB" }, { suffix: "Mi" }, { suffix: "GB" }, { suffix: "Gi" }];

describe(NumberUnitInput.name, () => {
  it("renders the current value and unit", () => {
    setup({ value: 256, unit: "MB" });

    expect(screen.getByLabelText("Memory")).toHaveValue(256);
    expect(screen.getByRole("combobox", { name: "Memory unit" })).toHaveTextContent("MB");
  });

  it("emits the parsed numeric value on input", async () => {
    const { onValueChange } = setup({ value: 256, unit: "MB" });

    const input = screen.getByLabelText("Memory");
    await userEvent.clear(input);
    await userEvent.type(input, "512");

    expect(onValueChange).toHaveBeenLastCalledWith(512);
  });

  it("emits undefined when the input is cleared", async () => {
    const { onValueChange } = setup({ value: 256, unit: "MB" });

    await userEvent.clear(screen.getByLabelText("Memory"));

    expect(onValueChange).toHaveBeenLastCalledWith(undefined);
  });

  it("emits the picked unit", async () => {
    const { onUnitChange } = setup({ value: 256, unit: "MB" });

    await userEvent.click(screen.getByRole("combobox", { name: "Memory unit" }));
    await userEvent.click(await screen.findByRole("option", { name: "Gi" }));

    expect(onUnitChange).toHaveBeenCalledWith("Gi");
  });

  it("announces the error as an alert and marks the field invalid", () => {
    setup({ value: 256, unit: "MB", error: "Memory is required." });

    expect(screen.getByRole("alert")).toHaveTextContent("Memory is required.");
    expect(screen.getByLabelText("Memory")).toHaveAttribute("aria-invalid", "true");
  });

  it("disables both halves when disabled", () => {
    setup({ value: 256, unit: "MB", disabled: true });

    expect(screen.getByLabelText("Memory")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Memory unit" })).toBeDisabled();
  });

  it("calls onBlur when the numeric input loses focus", async () => {
    const { onBlur } = setup({ value: 256, unit: "MB" });

    await userEvent.click(screen.getByLabelText("Memory"));
    await userEvent.tab();

    expect(onBlur).toHaveBeenCalled();
  });

  function setup(input: { value: number; unit: string; error?: string; disabled?: boolean }) {
    const onValueChange = vi.fn();
    const onUnitChange = vi.fn();
    const onBlur = vi.fn();
    function Harness() {
      const [value, setValue] = useState<number | undefined>(input.value);
      const [unit, setUnit] = useState(input.unit);
      return (
        <NumberUnitInput
          label="Memory"
          units={MEMORY_UNITS}
          value={value}
          unit={unit}
          error={input.error}
          disabled={input.disabled}
          onBlur={onBlur}
          onValueChange={next => {
            onValueChange(next);
            setValue(next);
          }}
          onUnitChange={next => {
            onUnitChange(next);
            setUnit(next);
          }}
        />
      );
    }
    render(<Harness />);
    return { onValueChange, onUnitChange, onBlur };
  }
});
