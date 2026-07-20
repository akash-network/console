import { describe, expect, it, vi } from "vitest";

import type { AddCreditsAmountValue } from "./AddCreditsAmountFields";
import { AddCreditsAmountFields } from "./AddCreditsAmountFields";

import { fireEvent, render, screen } from "@testing-library/react";

describe(AddCreditsAmountFields.name, () => {
  it("emits the chosen predefined amount and clears the custom amount", () => {
    const { onChange } = setup({ value: { predefinedAmount: "", customAmount: "75" } });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    expect(onChange).toHaveBeenCalledWith({ predefinedAmount: "100", customAmount: "" });
  });

  it("emits the custom amount and clears the predefined amount", () => {
    const { onChange } = setup({ value: { predefinedAmount: "100", customAmount: "" } });

    fireEvent.change(screen.getByLabelText("custom-amount"), { target: { value: "42" } });

    expect(onChange).toHaveBeenCalledWith({ predefinedAmount: "", customAmount: "42" });
  });

  it("renders the minimum in the custom amount label and input constraints", () => {
    setup({ value: { predefinedAmount: "", customAmount: "" }, minAmount: 100 });

    expect(screen.getByText(/minimum 100/)).toBeInTheDocument();
    expect(screen.getByLabelText("custom-amount")).toHaveAttribute("min", "100");
    expect(screen.getByLabelText("custom-amount")).toHaveAttribute("step", "0.01");
  });

  it("renders the inline validation error when provided", () => {
    setup({ value: { predefinedAmount: "", customAmount: "5" }, error: "Minimum amount is $20" });

    expect(screen.getByRole("alert")).toHaveTextContent("Minimum amount is $20");
  });

  it("renders no validation error by default", () => {
    setup({ value: { predefinedAmount: "", customAmount: "50" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports a committed predefined amount", () => {
    const { onAmountCommit } = setup({ value: { predefinedAmount: "", customAmount: "" } });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    expect(onAmountCommit).toHaveBeenCalledWith(100, false);
  });

  it("reports a committed custom amount on blur", () => {
    const { onAmountCommit } = setup({ value: { predefinedAmount: "", customAmount: "250" } });

    fireEvent.blur(screen.getByLabelText("custom-amount"));

    expect(onAmountCommit).toHaveBeenCalledWith(250, true);
  });

  it("does not report an empty custom amount on blur", () => {
    const { onAmountCommit } = setup({ value: { predefinedAmount: "", customAmount: "" } });

    fireEvent.blur(screen.getByLabelText("custom-amount"));

    expect(onAmountCommit).not.toHaveBeenCalled();
  });

  function setup(input: { value: AddCreditsAmountValue; minAmount?: number; error?: string; onAmountCommit?: (amount: number, isCustom: boolean) => void }) {
    const onChange = vi.fn();
    const onAmountCommit = input.onAmountCommit ?? vi.fn();
    render(
      <AddCreditsAmountFields value={input.value} onChange={onChange} minAmount={input.minAmount ?? 20} error={input.error} onAmountCommit={onAmountCommit} />
    );
    return { onChange, onAmountCommit };
  }
});
