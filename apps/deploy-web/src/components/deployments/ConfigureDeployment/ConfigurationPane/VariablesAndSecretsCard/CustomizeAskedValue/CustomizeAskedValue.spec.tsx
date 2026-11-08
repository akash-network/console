import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { TemplateAskedValue } from "@src/types/marketplace-template";
import type { AskedValueCustomization } from "../../../templateMode/TemplateModeProvider/TemplateModeProvider";
import { CustomizeAskedValue } from "./CustomizeAskedValue";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const MODEL: TemplateAskedValue = {
  key: "MODEL",
  label: "Model",
  type: "text",
  default: "gpt-4o-mini",
  required: false,
  bindings: [{ service: "litellm", env: "MODEL" }]
};

describe(CustomizeAskedValue.name, () => {
  it("edits label, type, help, choices and required", async () => {
    const { customizedNow, onDone } = setup({ askedValue: MODEL });

    await userEvent.clear(screen.getByLabelText("Label"));
    await userEvent.type(screen.getByLabelText("Label"), "LLM model");
    await chooseType("Choice");
    await userEvent.type(screen.getByLabelText("Help text"), "Which model");
    await userEvent.type(screen.getByLabelText("New choice"), "gpt-4o");
    await userEvent.click(screen.getByRole("button", { name: "Add choice" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Required" }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(customizedNow()).toEqual({ label: "LLM model", type: "choice", choices: ["gpt-4o-mini", "gpt-4o"], help: "Which model", required: true });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("marks the choice that is the row's value as the default and removes a choice", async () => {
    const { customizedNow } = setup({
      askedValue: { ...MODEL, type: "choice", choices: ["gpt-4o-mini", "gpt-4o"] },
      customized: { type: "choice", choices: ["gpt-4o-mini", "gpt-4o"] }
    });

    expect(screen.getByText("gpt-4o-mini").parentElement).toHaveTextContent(/gpt-4o-mini\s*default/);
    expect(screen.getByText("gpt-4o").parentElement).not.toHaveTextContent("default");

    await userEvent.click(screen.getByRole("button", { name: "Remove choice gpt-4o" }));

    expect(customizedNow().choices).toEqual(["gpt-4o-mini"]);
  });

  it("adds a choice on Enter and ignores a blank or repeated one", async () => {
    const { customizedNow } = setup({ askedValue: { ...MODEL, type: "choice", choices: ["a"] }, customized: { type: "choice", choices: ["a"] } });

    await userEvent.type(screen.getByLabelText("New choice"), " b {Enter}");
    await userEvent.type(screen.getByLabelText("New choice"), "a{Enter}");
    await userEvent.type(screen.getByLabelText("New choice"), "   {Enter}");

    expect(customizedNow().choices).toEqual(["a", "b"]);
    expect(screen.getByLabelText("New choice")).toHaveValue("   ");
  });

  it("starts the choices from nothing when the row has no value", async () => {
    const { customizedNow } = setup({ askedValue: { ...MODEL, default: undefined, required: true } });

    await chooseType("Choice");

    expect(customizedNow()).toEqual({ type: "choice", choices: [] });
  });

  it("keeps the choices already made when the type comes back to Choice", async () => {
    const { customizedNow } = setup({ askedValue: MODEL, customized: { choices: ["x", "y"] } });

    await chooseType("Choice");

    expect(customizedNow()).toEqual({ type: "choice", choices: ["x", "y"] });
  });

  it("locks the type of a secret", () => {
    setup({ askedValue: { key: "HF_TOKEN", label: "HF token", type: "secret", required: true, bindings: [] } });

    expect(screen.getByRole("combobox", { name: "Type" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Type" })).toHaveTextContent("Secret");
    expect(screen.queryByLabelText("Min length")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Required" })).toBeChecked();
  });

  it("shows the length limits", async () => {
    setup({ askedValue: { ...MODEL, help: "Pick" } });

    expect(screen.getByText("5/80")).toBeInTheDocument();
    expect(screen.getByText("4/500")).toBeInTheDocument();
    expect(screen.getByLabelText("Label")).toHaveAttribute("maxLength", "80");
    expect(screen.getByLabelText("Help text")).toHaveAttribute("maxLength", "500");

    await userEvent.type(screen.getByLabelText("Label"), "s");

    expect(screen.getByText("6/80")).toBeInTheDocument();
  });

  it("sets a text's minimum and maximum length and clears one back", async () => {
    const { customizedNow } = setup({ askedValue: MODEL });

    await userEvent.type(screen.getByLabelText("Min length"), "3");
    await userEvent.type(screen.getByLabelText("Max length"), "40");
    await userEvent.clear(screen.getByLabelText("Min length"));

    expect(customizedNow()).toEqual({ minLength: undefined, maxLength: 40 });
    expect(screen.queryByLabelText("Whole number")).not.toBeInTheDocument();
  });

  it("sets a number's range and whole-number rule", async () => {
    const { customizedNow } = setup({
      askedValue: { key: "WORKERS", label: "Workers", type: "number", default: "2", integer: true, required: false, bindings: [] }
    });

    expect(screen.getByRole("checkbox", { name: "Whole number" })).toBeChecked();

    await userEvent.type(screen.getByLabelText("Min"), "1");
    await userEvent.type(screen.getByLabelText("Max"), "8");
    await userEvent.click(screen.getByRole("checkbox", { name: "Whole number" }));

    expect(customizedNow()).toEqual({ min: 1, max: 8, integer: false });
    expect(screen.queryByLabelText("Min length")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("New choice")).not.toBeInTheDocument();
  });

  it("shows the values already customized", () => {
    setup({ askedValue: MODEL, customized: { label: "", help: "Kept help", required: true, minLength: 2 } });

    expect(screen.getByLabelText("Label")).toHaveValue("");
    expect(screen.getByLabelText("Help text")).toHaveValue("Kept help");
    expect(screen.getByRole("checkbox", { name: "Required" })).toBeChecked();
    expect(screen.getByLabelText("Min length")).toHaveValue(2);
    expect(screen.getByText(/Your value becomes the default\./)).toBeInTheDocument();
  });

  it("describes the label and help inputs with their counters", () => {
    setup({ askedValue: { ...MODEL, help: "Pick" } });

    expect(screen.getByLabelText("Label")).toHaveAccessibleDescription("5/80");
    expect(screen.getByLabelText("Help text")).toHaveAccessibleDescription("4/500");
  });

  it("does not say a secret's value becomes the default", () => {
    setup({ askedValue: { key: "HF_TOKEN", label: "HF token", type: "secret", required: true, bindings: [] } });

    expect(screen.queryByText(/Your value becomes the default\./)).not.toBeInTheDocument();
  });

  it("keeps a length a whole number of 0 or more", () => {
    const { customizedNow } = setup({ askedValue: MODEL });

    expect(screen.getByLabelText("Min length")).toHaveAttribute("min", "0");
    expect(screen.getByLabelText("Min length")).toHaveAttribute("step", "1");

    fireEvent.change(screen.getByLabelText("Min length"), { target: { value: "-3" } });
    fireEvent.change(screen.getByLabelText("Max length"), { target: { value: "7.8" } });

    expect(customizedNow()).toEqual({ minLength: 0, maxLength: 7 });
  });

  it("keeps a negative or fractional number range as typed", () => {
    const { customizedNow } = setup({ askedValue: { key: "TEMP", label: "Temp", type: "number", default: "0.5", required: false, bindings: [] } });

    expect(screen.getByLabelText("Min")).not.toHaveAttribute("step");
    expect(screen.getByLabelText("Min")).not.toHaveAttribute("min");

    fireEvent.change(screen.getByLabelText("Min"), { target: { value: "-1.5" } });

    expect(customizedNow()).toEqual({ min: -1.5 });
  });

  it.each<[string, TemplateAskedValue, AskedValueCustomization, string]>([
    [
      "number",
      { key: "WORKERS", label: "Workers", type: "number", default: "2", required: false, bindings: [] },
      { min: 8, max: 2 },
      "The minimum is above the maximum."
    ],
    ["text", MODEL, { minLength: 9, maxLength: 3 }, "The minimum length is above the maximum."]
  ])("flags a %s range whose minimum is above its maximum", (_, askedValue, customized, message) => {
    setup({ askedValue, customized });

    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });

  it.each<[string, TemplateAskedValue, AskedValueCustomization]>([
    ["an equal number range", { key: "WORKERS", label: "Workers", type: "number", default: "2", required: false, bindings: [] }, { min: 2, max: 2 }],
    ["a number range missing its maximum", { key: "WORKERS", label: "Workers", type: "number", default: "2", required: false, bindings: [] }, { min: 2 }],
    ["an equal length range", MODEL, { minLength: 3, maxLength: 3 }],
    ["a length range missing its minimum", MODEL, { maxLength: 3 }]
  ])("does not flag %s", (_, askedValue, customized) => {
    setup({ askedValue, customized });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stops adding choices at 50 and caps a choice at 200 characters", () => {
    const fifty = Array.from({ length: 50 }, (_, index) => `model-${index}`);
    setup({ askedValue: { ...MODEL, type: "choice", choices: fifty }, customized: { type: "choice", choices: fifty } });

    expect(screen.getByText("50/50")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add choice" })).toBeDisabled();
    expect(screen.getByLabelText("New choice")).toBeDisabled();
    expect(screen.getByLabelText("New choice")).toHaveAttribute("maxLength", "200");
  });

  it("counts the choices and asks for one while there are none", async () => {
    setup({ askedValue: { ...MODEL, default: undefined, required: true }, customized: { type: "choice", choices: [] } });

    expect(screen.getByText("Add at least one choice")).toBeInTheDocument();
    expect(screen.getByText("0/50")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add choice" })).toBeEnabled();

    await userEvent.type(screen.getByLabelText("New choice"), "a{Enter}");

    expect(screen.queryByText("Add at least one choice")).not.toBeInTheDocument();
    expect(screen.getByText("1/50")).toBeInTheDocument();
  });

  it("offers every type but Secret on a plain value", async () => {
    setup({ askedValue: MODEL });

    await userEvent.click(screen.getByRole("combobox", { name: "Type" }));

    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["Text", "Number", "Yes/No", "Choice"]);
  });

  async function chooseType(name: string) {
    await userEvent.click(screen.getByRole("combobox", { name: "Type" }));
    await userEvent.click(screen.getByRole("option", { name }));
  }

  function setup(input: { askedValue: TemplateAskedValue; customized?: AskedValueCustomization }) {
    const askedValue = structuredClone(input.askedValue);
    const initialCustomized = structuredClone(input.customized ?? {});
    const onCustomize = vi.fn<(patch: AskedValueCustomization) => void>();
    const onDone = vi.fn();

    const Harness = () => {
      const [customized, setCustomized] = useState(initialCustomized);
      return (
        <CustomizeAskedValue
          askedValue={askedValue}
          customized={customized}
          onCustomize={patch => {
            onCustomize(patch);
            setCustomized(current => ({ ...current, ...patch }));
          }}
          onDone={onDone}
        />
      );
    };
    render(<Harness />);

    const customizedNow = () => Object.assign({}, initialCustomized, ...onCustomize.mock.calls.map(([patch]) => patch)) as AskedValueCustomization;
    return { onCustomize, onDone, customizedNow };
  }
});
