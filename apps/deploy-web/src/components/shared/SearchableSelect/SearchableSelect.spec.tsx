import type { ReactNode } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { SearchableSelectOption } from "./SearchableSelect";
import { filterOptions, SearchableSelect } from "./SearchableSelect";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const OPTIONS: SearchableSelectOption[] = [
  { value: "eu-west", label: "eu-west" },
  { value: "eu-central", label: "eu-central" },
  { value: "na-us-west", label: "na-us-west" }
];

describe("SearchableSelect", () => {
  describe("filterOptions", () => {
    it("returns all options for an empty or whitespace query", () => {
      expect(filterOptions(OPTIONS, "")).toEqual(OPTIONS);
      expect(filterOptions(OPTIONS, "   ")).toEqual(OPTIONS);
    });

    it("matches case-insensitive substrings of the value", () => {
      expect(filterOptions(OPTIONS, "EU")).toEqual([OPTIONS[0], OPTIONS[1]]);
    });

    it("matches keywords in addition to the value", () => {
      const options: SearchableSelectOption[] = [
        { value: "a", label: "Alpha", keywords: ["first"] },
        { value: "b", label: "Beta" }
      ];
      expect(filterOptions(options, "first")).toEqual([options[0]]);
    });
  });

  it("shows the placeholder when nothing is selected and no empty option is given", () => {
    setup({ value: "", placeholder: "Select" });

    expect(screen.getByRole("combobox", { name: "Region" })).toHaveTextContent("Select");
  });

  it("shows the empty option label in the trigger when nothing is selected", () => {
    setup({ value: "", emptyOption: { value: "", label: "Any region" } });

    expect(screen.getByRole("combobox", { name: "Region" })).toHaveTextContent("Any region");
  });

  it("renders the selected value through renderValue in the trigger", () => {
    setup({ value: "na-us-west", renderValue: value => value.toUpperCase() });

    expect(screen.getByRole("combobox", { name: "Region" })).toHaveTextContent("NA-US-WEST");
  });

  it("writes the picked option, reflects it in the trigger, and resets the search", async () => {
    const { user, onChange } = setup({});
    const trigger = screen.getByRole("combobox", { name: "Region" });

    await user.click(trigger);
    await user.type(await screen.findByRole("combobox", { name: "Search regions" }), "na");
    await user.click(await screen.findByRole("option", { name: "na-us-west" }));

    expect(onChange).toHaveBeenCalledWith("na-us-west");
    expect(trigger).toHaveTextContent("na-us-west");

    await user.click(trigger);
    expect(await screen.findByRole("combobox", { name: "Search regions" })).toHaveValue("");
  });

  it("reports the empty option value when the empty option is picked", async () => {
    const { user, onChange } = setup({ value: "eu-west", emptyOption: { value: "", label: "Any region" } });

    await user.click(screen.getByRole("combobox", { name: "Region" }));
    await user.click(await screen.findByRole("option", { name: "Any region" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("filters options, shows the not-found message while keeping the empty option, and restores on clear", async () => {
    const { user } = setup({ emptyOption: { value: "", label: "Any region" } });

    await user.click(screen.getByRole("combobox", { name: "Region" }));
    const input = await screen.findByRole("combobox", { name: "Search regions" });

    await user.type(input, "eu");
    expect(screen.getByRole("option", { name: "eu-west" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "na-us-west" })).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "zzz");
    expect(screen.getByText("No regions found.")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Any region" })).toBeInTheDocument();

    await user.clear(input);
    expect(screen.getByRole("option", { name: "na-us-west" })).toBeInTheDocument();
  });

  it("renders a disabled option as non-selectable", async () => {
    const { user } = setup({ options: [{ value: "eu-west", label: "eu-west", disabled: true }] });

    await user.click(screen.getByRole("combobox", { name: "Region" }));

    expect(await screen.findByRole("option", { name: "eu-west" })).toHaveAttribute("aria-disabled", "true");
  });

  it("renders a disabled empty option as non-selectable", async () => {
    const { user, onChange } = setup({ value: "eu-west", emptyOption: { value: "", label: "Any region", disabled: true } });

    await user.click(screen.getByRole("combobox", { name: "Region" }));
    const emptyOption = await screen.findByRole("option", { name: "Any region" });

    expect(emptyOption).toHaveAttribute("aria-disabled", "true");

    await user.click(emptyOption);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables the trigger when disabled", () => {
    setup({ disabled: true });

    expect(screen.getByRole("combobox", { name: "Region" })).toBeDisabled();
  });

  function setup(input: {
    value?: string;
    options?: SearchableSelectOption[];
    emptyOption?: { value: string; label: string; disabled?: boolean };
    placeholder?: string;
    disabled?: boolean;
    renderValue?: (value: string) => ReactNode;
  }) {
    const onChange = vi.fn();
    const Harness = () => {
      const [value, setValue] = useState(input.value ?? "");
      return (
        <SearchableSelect
          value={value}
          onChange={function trackChange(next) {
            onChange(next);
            setValue(next);
          }}
          options={input.options ?? OPTIONS}
          ariaLabel="Region"
          searchLabel="Search regions"
          searchPlaceholder="Search regions..."
          notFoundMessage="No regions found."
          emptyOption={input.emptyOption}
          placeholder={input.placeholder}
          disabled={input.disabled}
          renderValue={input.renderValue}
        />
      );
    };

    render(<Harness />);

    return { user: userEvent.setup(), onChange };
  }
});
