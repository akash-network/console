import type { ReactNode } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import type { MarketplaceTemplate, TemplateAskedValue, TemplateVersionDetail } from "@src/types/marketplace-template";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { importDeploymentState } from "../../importDeploymentState/importDeploymentState";
import { DEPENDENCIES, TemplateVariablesCard } from "./TemplateVariablesCard";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildMarketplaceTemplate, buildTemplateVersion } from "@tests/seeders/userTemplate";
import { MockComponents } from "@tests/unit/mocks";

const TEMPLATE_SDL = [
  "version: '2.0'",
  "services:",
  "  vllm:",
  "    image: vllm/vllm-openai:v0.6.4",
  "    env:",
  "      - MODEL_ID=meta-llama/Llama-3.1-8B-Instruct",
  "      - HF_TOKEN=ac-secret://HF_TOKEN",
  "      - MAX_MODEL_LEN=8192",
  "    expose:",
  "      - port: 8000",
  "        as: 8000",
  "        to:",
  "          - global: true",
  "  webui:",
  "    image: ghcr.io/open-webui/open-webui:0.4.8",
  "    env:",
  "      - DEFAULT_MODELS=meta-llama/Llama-3.1-8B-Instruct",
  "      - WEBUI_NAME=Northwind chat",
  "      - ADMIN_EMAIL=",
  "      - ENABLE_SIGNUP=false",
  "    expose:",
  "      - port: 8080",
  "        as: 80",
  "        to:",
  "          - global: true",
  "profiles:",
  "  compute:",
  "    vllm:",
  "      resources:",
  "        cpu:",
  "          units: 1",
  "        memory:",
  "          size: 1Gi",
  "        storage:",
  "          - size: 1Gi",
  "    webui:",
  "      resources:",
  "        cpu:",
  "          units: 1",
  "        memory:",
  "          size: 1Gi",
  "        storage:",
  "          - size: 1Gi",
  "  placement:",
  "    dcloud:",
  "      pricing:",
  "        vllm:",
  "          denom: uact",
  "          amount: 1000",
  "        webui:",
  "          denom: uact",
  "          amount: 1000",
  "deployment:",
  "  vllm:",
  "    dcloud:",
  "      profile: vllm",
  "      count: 1",
  "  webui:",
  "    dcloud:",
  "      profile: webui",
  "      count: 1"
].join("\n");

const ASKED_VALUES: TemplateAskedValue[] = [
  {
    key: "MODEL_ID",
    label: "Model",
    help: "Hugging Face model vLLM loads at start.",
    type: "choice",
    required: true,
    choices: ["meta-llama/Llama-3.1-8B-Instruct", "Qwen/Qwen2.5-7B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"],
    default: "meta-llama/Llama-3.1-8B-Instruct",
    bindings: [
      { service: "vllm", env: "MODEL_ID" },
      { service: "webui", env: "DEFAULT_MODELS" }
    ]
  },
  { key: "HF_TOKEN", label: "Hugging Face token", type: "secret", required: true, bindings: [{ service: "vllm", env: "HF_TOKEN" }] },
  { key: "ADMIN_EMAIL", label: "Admin email", type: "text", required: true, bindings: [{ service: "webui", env: "ADMIN_EMAIL" }] },
  {
    key: "WEBUI_NAME",
    label: "App name",
    help: "Shown in the browser tab and login page.",
    type: "text",
    required: false,
    default: "Northwind chat",
    bindings: [{ service: "webui", env: "WEBUI_NAME" }]
  },
  {
    key: "MAX_MODEL_LEN",
    label: "Context length",
    help: "Max tokens per request.",
    type: "number",
    required: false,
    default: "8192",
    min: 2048,
    max: 32768,
    integer: true,
    bindings: [{ service: "vllm", env: "MAX_MODEL_LEN" }]
  },
  {
    key: "ENABLE_SIGNUP",
    label: "Allow sign-ups",
    help: "Off. Only the admin can create accounts.",
    type: "boolean",
    required: false,
    default: "false",
    bindings: [{ service: "webui", env: "ENABLE_SIGNUP" }]
  }
];

describe(TemplateVariablesCard.name, () => {
  it("shows each asked value as a field of its type with its key and help", () => {
    setup({});

    const model = screen.getByRole("combobox", { name: "Model" });
    expect(model).toHaveValue("meta-llama/Llama-3.1-8B-Instruct");
    expect(model).toHaveAccessibleDescription("MODEL_ID Hugging Face model vLLM loads at start.");
    expect(
      within(model)
        .getAllByRole("option")
        .map(option => option.textContent)
    ).toEqual(ASKED_VALUES[0].type === "choice" ? ASKED_VALUES[0].choices : []);
    expect(model).toBeRequired();

    const adminEmail = screen.getByRole("textbox", { name: "Admin email" });
    expect(adminEmail).toHaveValue("");
    expect(adminEmail).toHaveAccessibleDescription("ADMIN_EMAIL");
    expect(adminEmail).toBeRequired();

    const appName = screen.getByRole("textbox", { name: "App name" });
    expect(appName).toHaveValue("Northwind chat");
    expect(appName).not.toBeRequired();
    expect(screen.getAllByText("Optional")).toHaveLength(3);

    const contextLength = screen.getByRole("spinbutton", { name: "Context length" });
    expect(contextLength).toHaveValue(8192);
    expect(contextLength).toHaveAttribute("min", "2048");
    expect(contextLength).toHaveAttribute("max", "32768");
    expect(contextLength).toHaveAttribute("step", "1");
    expect(contextLength).toHaveAccessibleDescription("MAX_MODEL_LEN Max tokens per request.");

    const signUps = screen.getByRole("switch", { name: "Allow sign-ups" });
    expect(signUps).not.toBeChecked();
    expect(signUps).toHaveAccessibleDescription("ENABLE_SIGNUP Off. Only the admin can create accounts.");

    expect(screen.getByLabelText("Hugging Face token")).toHaveAttribute("type", "password");
    expect(screen.getByText("Variables")).toBeInTheDocument();
    expect(screen.getByText("These values go into the SDL below. Required fields are marked with *.")).toBeInTheDocument();
  });

  it("steps a number that need not be whole by any amount", () => {
    setup({ askedValues: [{ ...ASKED_VALUES[4], integer: false } as TemplateAskedValue] });

    expect(screen.getByRole("spinbutton", { name: "Context length" })).toHaveAttribute("step", "any");
  });

  it("shows a choice that is not set yet as a prompt to pick one", () => {
    setup({ sdl: TEMPLATE_SDL.replace("MODEL_ID=meta-llama/Llama-3.1-8B-Instruct", "MODEL_ID=") });

    expect(screen.getByRole("combobox", { name: "Model" })).toHaveDisplayValue("Choose…");
  });

  it("shows the filled values in the SDL preview", async () => {
    setup({});

    await userEvent.type(screen.getByRole("textbox", { name: "Admin email" }), "admin@northwind.dev");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Model" }), "Qwen/Qwen2.5-7B-Instruct");
    await userEvent.click(screen.getByRole("switch", { name: "Allow sign-ups" }));
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Context length" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Context length" }), "4096");

    const sdl = screen.getByTestId("sdl").textContent;
    expect(sdl).toContain("ADMIN_EMAIL=admin@northwind.dev");
    expect(sdl).toContain("MODEL_ID=Qwen/Qwen2.5-7B-Instruct");
    expect(sdl).toContain("DEFAULT_MODELS=Qwen/Qwen2.5-7B-Instruct");
    expect(sdl).toContain("ENABLE_SIGNUP=true");
    expect(sdl).toContain("MAX_MODEL_LEN=4096");
    expect(screen.getByRole("switch", { name: "Allow sign-ups" })).toBeChecked();
    expect(screen.getByText("On")).toBeInTheDocument();
  });

  it("masks a secret and says it is sealed on deploy", async () => {
    setup({});
    const token = screen.getByLabelText("Hugging Face token");

    await userEvent.type(token, "hf_secret");

    expect(token).toHaveAttribute("type", "password");
    expect(token).toHaveValue("hf_secret");
    expect(token).toHaveAccessibleDescription("HF_TOKEN Sealed when you deploy. You won't be able to see it again.");
    expect(screen.getByTestId("sdl").textContent).toContain("HF_TOKEN=ac-secret://HF_TOKEN");
    expect(screen.getByTestId("sdl").textContent).not.toContain("hf_secret");

    await userEvent.click(screen.getByRole("button", { name: "Show Hugging Face token" }));
    expect(token).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "Hide Hugging Face token" }));
    expect(token).toHaveAttribute("type", "password");
  });

  it("keeps a secret typed into a row the template left empty out of the SDL", async () => {
    setup({ sdl: TEMPLATE_SDL.replace("HF_TOKEN=ac-secret://HF_TOKEN", "HF_TOKEN=") });

    await userEvent.type(screen.getByLabelText("Hugging Face token"), "hf_secret");

    expect(screen.getByTestId("sdl").textContent).toContain("HF_TOKEN=ac-secret://HF_TOKEN");
    expect(screen.getByTestId("sdl").textContent).not.toContain("hf_secret");
  });

  it("shows a field's error once the field is left", async () => {
    setup({});
    const adminEmail = screen.getByRole("textbox", { name: "Admin email" });

    expect(adminEmail).not.toBeInvalid();
    expect(screen.queryByText("Enter a value for Admin email to continue.")).not.toBeInTheDocument();

    await userEvent.click(adminEmail);
    await userEvent.tab();

    expect(adminEmail).toBeInvalid();
    expect(adminEmail).toHaveAccessibleDescription("ADMIN_EMAIL Enter a value for Admin email to continue.");
    expect(screen.getByRole("textbox", { name: "App name" })).not.toBeInvalid();
    expect(screen.getByLabelText("Hugging Face token")).not.toBeInvalid();
  });

  it("shows a number's reason inline once the field is left", async () => {
    setup({});
    const contextLength = screen.getByRole("spinbutton", { name: "Context length" });

    await userEvent.clear(contextLength);
    await userEvent.type(contextLength, "100");
    await userEvent.tab();

    expect(contextLength).toBeInvalid();
    expect(screen.getByText("Context length is below 2048.")).toBeInTheDocument();
  });

  it("turns a switch off again and accepts a picked choice", async () => {
    setup({ sdl: TEMPLATE_SDL.replace("ENABLE_SIGNUP=false", "ENABLE_SIGNUP=").replace("MODEL_ID=meta-llama/Llama-3.1-8B-Instruct", "MODEL_ID=") });

    await userEvent.click(screen.getByRole("switch", { name: "Allow sign-ups" }));
    await userEvent.click(screen.getByRole("switch", { name: "Allow sign-ups" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Model" }), "Qwen/Qwen2.5-7B-Instruct");

    expect(screen.getByRole("switch", { name: "Allow sign-ups" })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Model" })).not.toBeInvalid();
    expect(screen.getByText("Off")).toBeInTheDocument();
  });

  it("shows every error and focuses the first field with one after a blocked deploy", () => {
    const { rerenderWith } = setup({});

    rerenderWith({ blockedAttempts: 1 });

    expect(screen.getByLabelText("Hugging Face token")).toBeInvalid();
    expect(screen.getByRole("textbox", { name: "Admin email" })).toBeInvalid();
    expect(screen.getByRole("combobox", { name: "Model" })).not.toBeInvalid();
    expect(screen.getByLabelText("Hugging Face token")).toHaveFocus();
  });

  it("focuses the first field with an error again on every blocked deploy", async () => {
    const { rerenderWith } = setup({});
    rerenderWith({ blockedAttempts: 1 });
    await userEvent.type(screen.getByLabelText("Hugging Face token"), "hf_secret");

    rerenderWith({ blockedAttempts: 2 });

    expect(screen.getByRole("textbox", { name: "Admin email" })).toHaveFocus();
  });

  it("resets every field to its default", async () => {
    setup({});
    await userEvent.type(screen.getByRole("textbox", { name: "Admin email" }), "admin@northwind.dev");
    await userEvent.type(screen.getByLabelText("Hugging Face token"), "hf_secret");
    await userEvent.clear(screen.getByRole("textbox", { name: "App name" }));
    await userEvent.tab();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Model" }), "Qwen/Qwen2.5-7B-Instruct");
    await userEvent.click(screen.getByRole("switch", { name: "Allow sign-ups" }));

    await userEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

    expect(screen.getByRole("textbox", { name: "Admin email" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Admin email" })).not.toBeInvalid();
    expect(screen.getByLabelText("Hugging Face token")).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "App name" })).toHaveValue("Northwind chat");
    expect(screen.getByRole("combobox", { name: "Model" })).toHaveValue("meta-llama/Llama-3.1-8B-Instruct");
    expect(screen.getByRole("switch", { name: "Allow sign-ups" })).not.toBeChecked();
    const sdl = screen.getByTestId("sdl").textContent;
    expect(sdl).toContain("DEFAULT_MODELS=meta-llama/Llama-3.1-8B-Instruct");
    expect(sdl).toContain("WEBUI_NAME=Northwind chat");
    expect(sdl).not.toContain("hf_secret");
  });

  it("shows a variable whose rows were removed as disabled", () => {
    setup({ sdl: TEMPLATE_SDL.replace("      - ADMIN_EMAIL=\n", "") });

    const adminEmail = screen.getByRole("textbox", { name: "Admin email" });
    expect(adminEmail).toBeDisabled();
    expect(adminEmail).not.toBeInvalid();
    expect(adminEmail).toHaveAccessibleDescription("ADMIN_EMAIL Not in this configuration anymore");
    expect(screen.getByRole("textbox", { name: "App name" })).toBeEnabled();
  });

  it("leaves a removed variable alone on reset", async () => {
    const { values } = setup({ sdl: TEMPLATE_SDL.replace("      - ADMIN_EMAIL=\n", "") });

    await userEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

    expect(values().services[1].env?.map(variable => variable.key)).toEqual(["DEFAULT_MODELS", "WEBUI_NAME", "ENABLE_SIGNUP"]);
  });

  it("disables every field and the reset while the deployment is locked", () => {
    setup({ disabled: true });

    expect(screen.getByRole("textbox", { name: "Admin email" })).toBeDisabled();
    expect(screen.getByLabelText("Hugging Face token")).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Allow sign-ups" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Model" })).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: "Context length" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset to defaults" })).toBeDisabled();
  });

  it("names the template, its current version and that Akash has not reviewed it", () => {
    const { TemplateIcon } = setup({ template: { title: "Open WebUI + vLLM", icon: "bot", isOfficial: false }, isCurrent: true });

    const card = screen.getByRole("region", { name: "Open WebUI + vLLM" });
    expect(within(card).getByText("v4 Current · Oct 30, 2026")).toBeInTheDocument();
    expect(within(card).getByText("Not reviewed by Akash")).toBeInTheDocument();
    expect(TemplateIcon).toHaveBeenCalledWith(expect.objectContaining({ icon: "bot" }), {});
  });

  it("names an older version by its number alone", () => {
    setup({ isCurrent: false });

    expect(screen.getByText("v4")).toBeInTheDocument();
    expect(screen.queryByText(/Current/)).not.toBeInTheDocument();
  });

  it("names the version by its number alone when the template has no current version", () => {
    setup({ template: { currentVersion: null } });

    expect(screen.getByText("v4")).toBeInTheDocument();
  });

  it("keeps the focus where it is after a blocked deploy when no variable needs fixing", async () => {
    const { rerenderWith } = setup({ askedValues: [ASKED_VALUES[3]] });
    const appName = screen.getByRole("textbox", { name: "App name" });
    await userEvent.click(appName);

    rerenderWith({ blockedAttempts: 1 });

    expect(appName).toHaveFocus();
  });

  it("leaves out the review notice for an official template", () => {
    setup({ template: { isOfficial: true } });

    expect(screen.queryByText("Not reviewed by Akash")).not.toBeInTheDocument();
  });

  it("shows only the template when it asks for nothing", () => {
    setup({ askedValues: [], template: { title: "Plain nginx" } });

    expect(screen.getByRole("region", { name: "Plain nginx" })).toBeInTheDocument();
    expect(screen.queryByText("Variables")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset to defaults" })).not.toBeInTheDocument();
  });

  function setup(input: {
    askedValues?: TemplateAskedValue[];
    sdl?: string;
    template?: Partial<MarketplaceTemplate>;
    isCurrent?: boolean;
    disabled?: boolean;
    blockedAttempts?: number;
  }) {
    const askedValues = structuredClone(input.askedValues ?? ASKED_VALUES);
    const version: TemplateVersionDetail = buildTemplateVersion({ id: "ver-4", version: 4, createdAt: "2026-10-30T12:00:00.000Z", askedValues });
    const template = buildMarketplaceTemplate({
      currentVersion: input.isCurrent === false ? buildTemplateVersion({ id: "ver-5", version: 5 }) : version,
      ...input.template
    });
    const initialValues = importDeploymentState(input.sdl ?? TEMPLATE_SDL).values;
    const TemplateIcon = vi.fn<typeof DEPENDENCIES.TemplateIcon>(() => null);
    const dependencies = MockComponents(DEPENDENCIES, { TemplateIcon });
    const formRef: { getValues?: () => SdlBuilderFormValuesType } = {};
    const card = (props: { disabled?: boolean; blockedAttempts?: number }) => (
      <TemplateVariablesCard
        askedValues={askedValues}
        template={template}
        version={version}
        disabled={props.disabled}
        blockedAttempts={props.blockedAttempts}
        dependencies={dependencies}
      />
    );

    const { rerender } = render(
      <FormHarness initialValues={initialValues} formRef={formRef}>
        {card(input)}
      </FormHarness>
    );

    return {
      TemplateIcon,
      values: () => formRef.getValues!(),
      rerenderWith: (props: { disabled?: boolean; blockedAttempts?: number }) =>
        rerender(
          <FormHarness initialValues={initialValues} formRef={formRef}>
            {card(props)}
          </FormHarness>
        )
    };
  }
});

function FormHarness({
  initialValues,
  formRef,
  children
}: {
  initialValues: SdlBuilderFormValuesType;
  formRef: { getValues?: () => SdlBuilderFormValuesType };
  children: ReactNode;
}) {
  const form = useForm<SdlBuilderFormValuesType>({ defaultValues: initialValues });
  formRef.getValues = form.getValues;
  return (
    <FormProvider {...form}>
      {children}
      <SdlPreview />
    </FormProvider>
  );
}

function SdlPreview() {
  const values = useWatch<SdlBuilderFormValuesType>() as SdlBuilderFormValuesType;
  return <pre data-testid="sdl">{generateSdl(values, { sealSecrets: true })}</pre>;
}
