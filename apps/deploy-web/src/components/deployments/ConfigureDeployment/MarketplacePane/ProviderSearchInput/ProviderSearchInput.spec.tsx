import { describe, expect, it, vi } from "vitest";

import { ProviderSearchInput } from "./ProviderSearchInput";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ProviderSearchInput.name, () => {
  it("calls onChange with the typed value", async () => {
    const { onChange } = setup({ value: "" });

    await userEvent.type(screen.getByRole("searchbox", { name: /search providers/i }), "a");

    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("hides the clear button when empty", () => {
    setup({ value: "" });

    expect(screen.queryByRole("button", { name: /clear search/i })).not.toBeInTheDocument();
  });

  it("shows a clear button when there is a value and calls onClear", async () => {
    const { onClear } = setup({ value: "abc" });

    await userEvent.click(screen.getByRole("button", { name: /clear search/i }));

    expect(onClear).toHaveBeenCalled();
  });

  function setup(input: { value?: string }) {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(<ProviderSearchInput value={input.value ?? ""} onChange={onChange} onClear={onClear} />);
    return { onChange, onClear };
  }
});
