import { describe, expect, it, vi } from "vitest";

import type { AddCreditsAmountValue } from "./AddCreditsAmountFields";
import { AddCreditsAmountFields } from "./AddCreditsAmountFields";

import { fireEvent, render, screen } from "@testing-library/react";

describe(AddCreditsAmountFields.name, () => {
  it("emits the chosen predefined amount and clears the custom amount", () => {
    const { onChange } = setup({ value: { predefinedAmount: "", customAmount: "75" } });

    fireEvent.click(screen.getByRole("radio", { name: /100/i }));

    expect(onChange).toHaveBeenCalledWith({ predefinedAmount: "100", customAmount: "" });
  });

  it("emits the custom amount and clears the predefined amount", () => {
    const { onChange } = setup({ value: { predefinedAmount: "100", customAmount: "" } });

    fireEvent.change(screen.getByLabelText("custom-amount"), { target: { value: "42" } });

    expect(onChange).toHaveBeenCalledWith({ predefinedAmount: "", customAmount: "42" });
  });

  function setup(input: { value: AddCreditsAmountValue }) {
    const onChange = vi.fn();
    render(<AddCreditsAmountFields value={input.value} onChange={onChange} />);
    return { onChange };
  }
});
