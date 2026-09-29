import type { ReactNode } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { SearchableSelectOption } from "./SearchableSelect";
import { filterOptions, SearchableSelect } from "./SearchableSelect";

import { render, screen, within } from "@testing-library/react";
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

  it("shows the empty trigger label in place of the empty option label while nothing is selected", () => {
    setup({ value: "", emptyOption: { value: "", label: "Any region" }, emptyTriggerLabel: "Select" });

    expect(screen.getByRole("combobox", { name: "Region" })).toHaveTextContent("Select");
    expect(screen.getByRole("combobox", { name: "Region" })).not.toHaveTextContent("Any region");
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

  it("describes an option with its hint", async () => {
    const { user } = setup({ options: [{ value: "eu-west", label: "eu-west", hint: "3 providers" }] });

    await user.click(screen.getByRole("combobox", { name: "Region" }));

    expect(await screen.findByRole("option", { name: "eu-west" })).toHaveAccessibleDescription("3 providers");
  });

  describe("unavailable options", () => {
    it("lists them after the other options under an Unavailable heading", async () => {
      const { user } = setup({ unavailableOptions: [{ value: "as-east", label: "as-east" }] });

      await user.click(screen.getByRole("combobox", { name: "Region" }));
      const unavailable = within(await screen.findByRole("group", { name: "Unavailable" }));

      expect(unavailable.getByRole("option", { name: "as-east" })).toHaveAttribute("aria-disabled", "true");
      expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["eu-west", "eu-central", "na-us-west", "as-east"]);
    });

    it("does not let one be picked", async () => {
      const { user, onChange } = setup({ unavailableOptions: [{ value: "as-east", label: "as-east" }] });

      await user.click(screen.getByRole("combobox", { name: "Region" }));
      await user.click(await screen.findByRole("option", { name: "as-east" }));

      expect(onChange).not.toHaveBeenCalled();
    });

    it("filters them with the search box and leaves the heading out when none match", async () => {
      const { user } = setup({ unavailableOptions: [{ value: "as-east", label: "as-east" }] });

      await user.click(screen.getByRole("combobox", { name: "Region" }));
      await user.type(await screen.findByRole("combobox", { name: "Search regions" }), "eu");

      expect(screen.getByRole("option", { name: "eu-west" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "as-east" })).not.toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Unavailable" })).not.toBeInTheDocument();
    });

    it("shows the not-found message only when neither list matches the search", async () => {
      const { user } = setup({ unavailableOptions: [{ value: "as-east", label: "as-east" }] });

      await user.click(screen.getByRole("combobox", { name: "Region" }));
      const input = await screen.findByRole("combobox", { name: "Search regions" });

      await user.type(input, "as");
      expect(screen.getByRole("option", { name: "as-east" })).toBeInTheDocument();
      expect(screen.queryByText("No regions found.")).not.toBeInTheDocument();

      await user.clear(input);
      await user.type(input, "zzz");
      expect(screen.getByText("No regions found.")).toBeInTheDocument();
    });
  });

  describe("sections", () => {
    it("groups the options under the heading without announcing its column label", async () => {
      const { user } = setup({ optionsHeading: { label: "Available", hintLabel: "Providers" } });

      await user.click(screen.getByRole("combobox", { name: "Region" }));
      const available = within(await screen.findByRole("group", { name: "Available" }));

      expect(available.getAllByRole("option").map(option => option.textContent)).toEqual(["eu-west", "eu-central", "na-us-west"]);
      expect(screen.getByText("Providers")).toBeInTheDocument();
    });

    it("separates the empty option, the options and the unavailable options", async () => {
      const { user } = setup({
        optionsHeading: { label: "Available" },
        emptyOption: { value: "", label: "Any region" },
        unavailableOptions: [{ value: "as-east", label: "as-east" }]
      });

      await user.click(screen.getByRole("combobox", { name: "Region" }));

      expect(await screen.findAllByRole("separator")).toHaveLength(2);
    });

    it("leaves the separators out without a heading", async () => {
      const { user } = setup({ emptyOption: { value: "", label: "Any region" }, unavailableOptions: [{ value: "as-east", label: "as-east" }] });

      await user.click(screen.getByRole("combobox", { name: "Region" }));
      await screen.findByRole("group", { name: "Unavailable" });

      expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    });

    it("leaves the heading out while the search matches none of the options", async () => {
      const { user } = setup({ optionsHeading: { label: "Available" }, unavailableOptions: [{ value: "as-east", label: "as-east" }] });

      await user.click(screen.getByRole("combobox", { name: "Region" }));
      await user.type(await screen.findByRole("combobox", { name: "Search regions" }), "as");

      expect(screen.getByRole("option", { name: "as-east" })).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Available" })).not.toBeInTheDocument();
    });

    it("names the unavailable group after the given heading", async () => {
      const { user } = setup({
        optionsHeading: { label: "Available" },
        unavailableHeading: "Others",
        unavailableOptions: [{ value: "as-east", label: "as-east" }]
      });

      await user.click(screen.getByRole("combobox", { name: "Region" }));
      const others = within(await screen.findByRole("group", { name: "Others" }));

      expect(others.getByRole("option", { name: "as-east" })).toHaveAttribute("aria-disabled", "true");
    });
  });

  it("renders the footer with the live search text", async () => {
    const { user } = setup({ renderFooter: search => <p>Looking for {search || "nothing"}</p> });

    await user.click(screen.getByRole("combobox", { name: "Region" }));
    expect(await screen.findByText("Looking for nothing")).toBeInTheDocument();

    await user.type(screen.getByRole("combobox", { name: "Search regions" }), "b300");
    expect(screen.getByText("Looking for b300")).toBeInTheDocument();
  });

  it("lets the footer close the popover and resets the search", async () => {
    const { user } = setup({
      renderFooter: (search, { close }) => (
        <button type="button" onClick={close}>
          Ask for {search || "nothing"}
        </button>
      )
    });

    await user.click(screen.getByRole("combobox", { name: "Region" }));
    await user.type(await screen.findByRole("combobox", { name: "Search regions" }), "b300");
    await user.click(screen.getByRole("button", { name: "Ask for b300" }));

    expect(screen.queryByRole("combobox", { name: "Search regions" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Region" }));

    expect(await screen.findByRole("button", { name: "Ask for nothing" })).toBeInTheDocument();
  });

  function setup(input: {
    value?: string;
    options?: SearchableSelectOption[];
    unavailableOptions?: SearchableSelectOption[];
    optionsHeading?: { label: string; hintLabel?: string };
    unavailableHeading?: string;
    renderFooter?: (search: string, controls: { close: () => void }) => ReactNode;
    emptyOption?: { value: string; label: string; disabled?: boolean };
    emptyTriggerLabel?: string;
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
          unavailableOptions={input.unavailableOptions}
          optionsHeading={input.optionsHeading}
          unavailableHeading={input.unavailableHeading}
          renderFooter={input.renderFooter}
          ariaLabel="Region"
          searchLabel="Search regions"
          searchPlaceholder="Search regions..."
          notFoundMessage="No regions found."
          emptyOption={input.emptyOption}
          emptyTriggerLabel={input.emptyTriggerLabel}
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
