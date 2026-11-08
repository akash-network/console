import { describe, expect, it, vi } from "vitest";

import type { TemplateAskedValue } from "@src/types/marketplace-template";
import type { AskedValueCustomization } from "../../../templateMode/TemplateModeProvider/TemplateModeProvider";
import { AskTheDeployerControl } from "./AskTheDeployerControl";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const SWITCH_NAME = "Ask the deployer for Environment variable 1";
const SECRET_NOTE = "The deployer provides this; your value isn't saved.";
const UNASKABLE_KEY_WARNING = "This key can't be asked to the deployer. Rename it with letters, digits and underscores only.";

const LOG_LEVEL: TemplateAskedValue = { key: "LOG_LEVEL", label: "Log level", type: "text", default: "info", required: false, bindings: [] };
const HF_TOKEN: TemplateAskedValue = { key: "HF_TOKEN", label: "HF token", type: "secret", required: true, bindings: [] };

describe(AskTheDeployerControl.name, () => {
  it("says an unasked plain value is saved as is and asks for it on toggle", async () => {
    const { onAskedChange } = setup({ envKey: "LOG_LEVEL", isSecret: false, isAsked: false });

    expect(screen.getByRole("switch", { name: SWITCH_NAME })).not.toBeChecked();
    expect(screen.getByText("· saved as is")).toBeInTheDocument();
    expect(screen.queryByText(/^Asked as/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: SWITCH_NAME }));

    expect(onAskedChange).toHaveBeenCalledWith(true);
  });

  it("stops asking for a plain value on toggle", async () => {
    const { onAskedChange } = setup({ envKey: "LOG_LEVEL", isSecret: false, isAsked: true, askedValue: LOG_LEVEL });

    expect(screen.getByRole("switch", { name: SWITCH_NAME })).toBeChecked();
    expect(screen.queryByText("· saved as is")).not.toBeInTheDocument();
    expect(screen.queryByText(SECRET_NOTE)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: SWITCH_NAME }));

    expect(onAskedChange).toHaveBeenCalledWith(false);
  });

  it("keeps a secret asked with its toggle locked", () => {
    setup({ envKey: "HF_TOKEN", isSecret: true, isAsked: true, askedValue: HF_TOKEN });

    expect(screen.getByRole("switch", { name: SWITCH_NAME })).toBeChecked();
    expect(screen.getByRole("switch", { name: SWITCH_NAME })).toBeDisabled();
    expect(screen.getByText("· always on for secrets")).toBeInTheDocument();
    expect(screen.getByText(SECRET_NOTE)).toBeInTheDocument();
    expect(screen.getByText(/^Asked as/)).toHaveTextContent("Asked as HF token · Secret · Required");
  });

  it.each<[string, TemplateAskedValue, string]>([
    ["a text with a default", LOG_LEVEL, "Asked as Log level · Text · Your value is the default"],
    [
      "a number",
      { key: "PORT", label: "Port", type: "number", default: "80", required: false, bindings: [] },
      "Asked as Port · Number · Your value is the default"
    ],
    [
      "a yes/no",
      { key: "DEBUG", label: "Debug", type: "boolean", default: "true", required: false, bindings: [] },
      "Asked as Debug · Yes/No · Your value is the default"
    ],
    [
      "a choice",
      { key: "MODEL", label: "Model", type: "choice", choices: ["a", "b", "c"], default: "a", required: true, bindings: [] },
      "Asked as Model · Choice of 3 · Your value is the default"
    ],
    ["a required value without a default", { key: "NAME", label: "Name", type: "text", required: true, bindings: [] }, "Asked as Name · Text · Required"],
    ["an optional value without a default", { key: "NAME", label: "Name", type: "text", required: false, bindings: [] }, "Asked as Name · Text · Optional"]
  ])("summarizes %s", (_, askedValue, summary) => {
    setup({ envKey: askedValue.key, isSecret: false, isAsked: true, askedValue });

    expect(screen.getByText(/^Asked as/)).toHaveTextContent(summary);
  });

  it("opens Customize and closes it with Done", async () => {
    const { onCustomize } = setup({ envKey: "LOG_LEVEL", isSecret: false, isAsked: true, askedValue: LOG_LEVEL });

    await userEvent.click(screen.getByRole("button", { name: "Customize" }));
    await userEvent.type(screen.getByLabelText("Help text"), "x");

    expect(onCustomize).toHaveBeenCalledWith({ help: "x" });

    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByLabelText("Help text")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Customize" })).toBeInTheDocument();
  });

  it("shows no summary while the key is still empty", () => {
    setup({ envKey: "", isSecret: true, isAsked: true });

    expect(screen.getByRole("switch", { name: SWITCH_NAME })).toBeChecked();
    expect(screen.queryByText(/^Asked as/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Customize" })).not.toBeInTheDocument();
    expect(screen.queryByText(UNASKABLE_KEY_WARNING)).not.toBeInTheDocument();
  });

  it.each([
    ["secret", true],
    ["plain value", false]
  ])("warns instead of toggling a %s whose key the deployer cannot be asked for", (_, isSecret) => {
    setup({ envKey: "my-key", isSecret, isAsked: isSecret });

    expect(screen.getByText(UNASKABLE_KEY_WARNING)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  function setup(input: { envKey: string; isSecret: boolean; isAsked: boolean; askedValue?: TemplateAskedValue; customized?: AskedValueCustomization }) {
    const onAskedChange = vi.fn();
    const onCustomize = vi.fn();
    render(
      <AskTheDeployerControl
        rowLabel="Environment variable 1"
        envKey={input.envKey}
        isSecret={input.isSecret}
        isAsked={input.isAsked}
        askedValue={input.askedValue && structuredClone(input.askedValue)}
        customized={structuredClone(input.customized ?? {})}
        onAskedChange={onAskedChange}
        onCustomize={onCustomize}
      />
    );
    return { onAskedChange, onCustomize };
  }
});
