import { describe, expect, it, vi } from "vitest";

import type { ServiceType } from "@src/types";
import type { TemplateAskedValue } from "@src/types/marketplace-template";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { SaveTemplateDialog } from "./SaveTemplateDialog";

import { fireEvent, render, screen, within } from "@testing-library/react";

const MODEL: TemplateAskedValue = { key: "LITELLM_MODEL", label: "Model", type: "choice", choices: ["gpt-4o-mini"], required: true, bindings: [] };
const MASTER_KEY: TemplateAskedValue = { key: "LITELLM_MASTER_KEY", label: "LiteLLM master key", type: "secret", required: true, bindings: [] };
const OPENAI_KEY: TemplateAskedValue = { key: "OPENAI_API_KEY", label: "OpenAI API key", type: "secret", required: true, bindings: [] };

describe(SaveTemplateDialog.name, () => {
  it("asks only for a title and an optional summary", () => {
    setup({});

    expect(screen.getByRole("dialog", { name: "Save template" })).toBeInTheDocument();
    expect(screen.getByText("Only the title is needed. You can change everything later on the template page.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveAttribute("maxLength", "80");
    expect(screen.getByRole("textbox", { name: /Summary/ })).toHaveAttribute("maxLength", "200");
    expect(screen.getByText("Optional")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("");
    expect(screen.queryByText("From the deployment name")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("prefills the title from the deployment name", () => {
    setup({ initialTitle: "support-bot", isTitleFromDeployment: true });

    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("support-bot");
    expect(screen.getByText("From the deployment name")).toBeInTheDocument();
    expect(screen.getByText("11 / 80")).toBeInTheDocument();
  });

  it("credits no deployment for a name typed in the editor", () => {
    setup({ initialTitle: "my-template" });

    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("my-template");
    expect(screen.queryByText("From the deployment name")).not.toBeInTheDocument();
  });

  it("stops crediting the deployment name once the title is changed", () => {
    setup({ initialTitle: "support-bot", isTitleFromDeployment: true });

    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Support chat" } });

    expect(screen.queryByText("From the deployment name")).not.toBeInTheDocument();
  });

  it("counts the summary", () => {
    setup({});

    fireEvent.change(screen.getByRole("textbox", { name: /Summary/ }), { target: { value: "Chat with models" } });

    expect(screen.getByText("16 / 200")).toBeInTheDocument();
  });

  it("saves the trimmed title and summary", () => {
    const { onSave } = setup({});

    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "  Support chat  " } });
    fireEvent.change(screen.getByRole("textbox", { name: /Summary/ }), { target: { value: "  Chat with models " } });
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));

    expect(onSave).toHaveBeenCalledWith({ title: "Support chat", summary: "Chat with models" });
  });

  it("needs a title to save", () => {
    const { onSave } = setup({});

    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "   " } });

    expect(screen.getByRole("button", { name: "Save template" })).toBeDisabled();
    fireEvent.submit(screen.getByRole("textbox", { name: "Title" }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("holds the save while one is in flight", () => {
    setup({ initialTitle: "support-bot", isSaving: true });

    expect(screen.getByRole("button", { name: /Save template/ })).toBeDisabled();
  });

  it("says the template is saved as private in the project", () => {
    setup({ projectName: "support-tools" });

    expect(screen.getByText("Saved as Private in support-tools. Make it available to your organization from the template page.")).toBeInTheDocument();
  });

  it("says the template is saved as private without a project", () => {
    setup({});

    expect(screen.getByText("Saved as Private. Make it available to your organization from the template page.")).toBeInTheDocument();
  });

  it("recaps the values asked, the secrets, the values saved as is and the services", () => {
    setup({
      askedValues: [MODEL, MASTER_KEY, OPENAI_KEY],
      savedAsIs: ["WEBUI_NAME", "OPENAI_API_BASE_URL", "LOG_LEVEL"],
      services: ["webui", "litellm"],
      sourceName: "support-bot"
    });

    const recap = within(screen.getByRole("list", { name: "Recap" }));
    expect(recap.getByText("3 values asked to the deployer")).toBeInTheDocument();
    expect(recap.getByText("Model, LiteLLM master key, OpenAI API key")).toBeInTheDocument();
    expect(recap.getByText("2 secrets")).toBeInTheDocument();
    expect(recap.getByText("Your values for LITELLM_MASTER_KEY and OPENAI_API_KEY aren't saved.")).toBeInTheDocument();
    expect(recap.getByText("3 values saved as is")).toBeInTheDocument();
    expect(recap.getByText("WEBUI_NAME, OPENAI_API_BASE_URL, LOG_LEVEL")).toBeInTheDocument();
    expect(recap.getByText("2 services from support-bot")).toBeInTheDocument();
    expect(recap.getByText("webui, litellm · 2 vCPU · 2 GiB")).toBeInTheDocument();
  });

  it("recaps single values in the singular", () => {
    setup({ askedValues: [MASTER_KEY], savedAsIs: ["LOG_LEVEL"], services: ["web"] });

    const recap = within(screen.getByRole("list", { name: "Recap" }));
    expect(recap.getByText("1 value asked to the deployer")).toBeInTheDocument();
    expect(recap.getByText("1 secret")).toBeInTheDocument();
    expect(recap.getByText("Your value for LITELLM_MASTER_KEY isn't saved.")).toBeInTheDocument();
    expect(recap.getByText("1 value saved as is")).toBeInTheDocument();
    expect(recap.getByText("1 service")).toBeInTheDocument();
  });

  it("lists three secrets with a final and", () => {
    setup({ askedValues: [MASTER_KEY, OPENAI_KEY, { ...MASTER_KEY, key: "HF_TOKEN", label: "HF token" }] });

    expect(screen.getByText("Your values for LITELLM_MASTER_KEY, OPENAI_API_KEY and HF_TOKEN aren't saved.")).toBeInTheDocument();
  });

  it("leaves out recap rows with nothing to report", () => {
    setup({});

    expect(screen.queryByText(/asked to the deployer/)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret/)).not.toBeInTheDocument();
    expect(screen.queryByText(/saved as is/)).not.toBeInTheDocument();
  });

  it("recaps the values that look like keys and will be saved as they are", () => {
    setup({ lookalikeKeys: ["OPENAI_API_KEY", "HF_TOKEN"] });

    const recap = within(screen.getByRole("list", { name: "Recap" }));
    expect(recap.getByText("2 values look like keys and will be saved as is")).toBeInTheDocument();
    expect(recap.getByText("OPENAI_API_KEY, HF_TOKEN")).toBeInTheDocument();
  });

  it("recaps a single value that looks like a key in the singular", () => {
    setup({ lookalikeKeys: ["OPENAI_API_KEY"] });

    expect(screen.getByText("1 value looks like a key and will be saved as is")).toBeInTheDocument();
  });

  it("starts from a suggested summary and goes back to it on cancel", () => {
    const { rerender } = setup({ initialTitle: "Support chat", initialSummary: "Chat through one key." });
    const summary = () => screen.getByRole("textbox", { name: /Summary/ });
    expect(summary()).toHaveValue("Chat through one key.");

    fireEvent.change(summary(), { target: { value: "Something else" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    rerender({ open: false });
    rerender({ open: true });

    expect(summary()).toHaveValue("Chat through one key.");
  });

  it("refuses to save a secret whose key cannot be asked for", () => {
    const { onSave } = setup({ initialTitle: "support-bot", unaskableSecrets: [{ service: "web", key: "api-key" }] });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Rename api-key in web: a secret's key can only use letters, digits and underscores, can't start with a digit and is at most 64 characters."
    );
    expect(screen.getByRole("button", { name: "Save template" })).toBeDisabled();
    fireEvent.submit(screen.getByRole("textbox", { name: "Title" }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("goes back to the configuration keeping the summary and restarts the title from the current name", () => {
    const { onClose, rerender } = setup({ initialTitle: "support-bot" });

    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Support chat" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Summary/ }), { target: { value: "Chat with models" } });
    fireEvent.click(screen.getByRole("button", { name: "Back to configuration" }));
    rerender({ open: false, initialTitle: "support-bot-v2" });
    rerender({ open: true, initialTitle: "support-bot-v2" });

    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("support-bot-v2");
    expect(screen.getByRole("textbox", { name: /Summary/ })).toHaveValue("Chat with models");
  });

  it("keeps the title while it stays open", () => {
    const { rerender } = setup({ initialTitle: "support-bot" });

    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Support chat" } });
    rerender({ open: true, initialTitle: "support-bot-v2" });

    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Support chat");
  });

  it("forgets what was typed on cancel", () => {
    const { onClose, rerender } = setup({ initialTitle: "support-bot" });

    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Support chat" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Summary/ }), { target: { value: "Chat with models" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    rerender({ open: false });
    rerender({ open: true });

    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("support-bot");
    expect(screen.getByRole("textbox", { name: /Summary/ })).toHaveValue("");
  });

  it("closes on escape", () => {
    const { onClose } = setup({});

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("stays open on escape while saving", () => {
    const { onClose } = setup({ initialTitle: "support-bot", isSaving: true });

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows nothing while closed", () => {
    setup({ open: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  function setup(input: {
    open?: boolean;
    initialTitle?: string;
    isTitleFromDeployment?: boolean;
    projectName?: string;
    sourceName?: string;
    askedValues?: TemplateAskedValue[];
    savedAsIs?: string[];
    lookalikeKeys?: string[];
    initialSummary?: string;
    unaskableSecrets?: Array<{ service: string; key: string }>;
    services?: string[];
    isSaving?: boolean;
  }) {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const services: ServiceType[] = (input.services ?? ["web"]).map(title => {
      const service = defaultServiceWithPlacement().services[0];
      return { ...service, id: title, title, count: 1, profile: { ...service.profile, cpu: 1, ram: 1, ramUnit: "Gi", storage: [] } };
    });
    const renderDialog = (open: boolean, initialTitle = input.initialTitle) => (
      <SaveTemplateDialog
        open={open}
        initialTitle={initialTitle}
        isTitleFromDeployment={input.isTitleFromDeployment}
        initialSummary={input.initialSummary}
        projectName={input.projectName}
        sourceName={input.sourceName}
        askedValues={input.askedValues ?? []}
        savedAsIs={input.savedAsIs ?? []}
        lookalikeKeys={input.lookalikeKeys ?? []}
        unaskableSecrets={input.unaskableSecrets ?? []}
        services={services}
        isSaving={input.isSaving ?? false}
        onSave={onSave}
        onClose={onClose}
      />
    );

    const view = render(renderDialog(input.open ?? true));
    const rerender = (next: { open: boolean; initialTitle?: string }) => view.rerender(renderDialog(next.open, next.initialTitle ?? input.initialTitle));

    return { onSave, onClose, rerender };
  }
});
