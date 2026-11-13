import { describe, expect, it } from "vitest";

import type { TemplateAskedValue } from "@src/types/marketplace-template";
import { AskedValuesList } from "./AskedValuesList";

import { render, screen, within } from "@testing-library/react";

const MODEL: TemplateAskedValue = {
  key: "MODEL_ID",
  label: "Model",
  help: "Hugging Face model vLLM loads at start.",
  required: true,
  bindings: [{ service: "vllm", env: "MODEL_ID" }],
  type: "choice",
  choices: ["meta-llama/Llama-3.1-8B-Instruct", "Qwen/Qwen2.5-14B"],
  default: "meta-llama/Llama-3.1-8B-Instruct"
};
const HF_TOKEN: TemplateAskedValue = {
  key: "HF_TOKEN",
  label: "Hugging Face token",
  required: true,
  bindings: [{ service: "vllm", env: "HF_TOKEN" }],
  type: "secret"
};
const ADMIN_EMAIL: TemplateAskedValue = {
  key: "ADMIN_EMAIL",
  label: "Admin email",
  required: true,
  bindings: [{ service: "webui", env: "ADMIN_EMAIL" }],
  type: "text"
};
const CONTEXT_LENGTH: TemplateAskedValue = {
  key: "MAX_MODEL_LEN",
  label: "Context length",
  required: false,
  bindings: [{ service: "vllm", env: "MAX_MODEL_LEN" }],
  type: "number",
  default: "8192"
};
const SIGNUPS: TemplateAskedValue = {
  key: "ENABLE_SIGNUP",
  label: "Allow sign-ups",
  required: false,
  bindings: [{ service: "webui", env: "ENABLE_SIGNUP" }],
  type: "boolean",
  default: "false"
};
const EMPTY_DEFAULT: TemplateAskedValue = {
  key: "APP_NAME",
  label: "App name",
  required: false,
  bindings: [{ service: "webui", env: "WEBUI_NAME" }],
  type: "text",
  default: ""
};

describe(AskedValuesList.name, () => {
  it("lists the asked values with their key, requirement and default", () => {
    setup({ askedValues: [MODEL, HF_TOKEN, ADMIN_EMAIL, CONTEXT_LENGTH, SIGNUPS] });

    expect(screen.getByRole("region", { name: "Variables" })).toBeInTheDocument();
    expect(screen.getByText("You fill these in on the next step")).toBeInTheDocument();
    const [model, token, email, contextLength, signups] = screen.getAllByRole("listitem");
    expectRow(model, { label: "Model", key: "MODEL_ID", value: "default meta-llama/Llama-3.1-8B-Instruct", isRequired: true, isSecret: false });
    expect(within(model).getByText("Hugging Face model vLLM loads at start.")).toBeInTheDocument();
    expectRow(token, { label: "Hugging Face token", key: "HF_TOKEN", value: "you enter it, sealed", isRequired: true, isSecret: true });
    expectRow(email, { label: "Admin email", key: "ADMIN_EMAIL", value: "no default", isRequired: true, isSecret: false });
    expectRow(contextLength, { label: "Context length", key: "MAX_MODEL_LEN", value: "default 8192", isRequired: false, isSecret: false });
    expectRow(signups, { label: "Allow sign-ups", key: "ENABLE_SIGNUP", value: "default false", isRequired: false, isSecret: false });
  });

  it("reads an empty default as no default", () => {
    setup({ askedValues: [EMPTY_DEFAULT] });

    expectRow(screen.getByRole("listitem"), { label: "App name", key: "APP_NAME", value: "no default", isRequired: false, isSecret: false });
  });

  it("renders nothing when the template asks for nothing", () => {
    const { container } = setup({ askedValues: [] });

    expect(container).toBeEmptyDOMElement();
  });

  function expectRow(row: HTMLElement, expected: { label: string; key: string; value: string; isRequired: boolean; isSecret: boolean }) {
    expect(within(row).getByText(expected.label)).toBeInTheDocument();
    expect(within(row).getByText(expected.key)).toBeInTheDocument();
    expect(within(row).getByText(expected.value)).toBeInTheDocument();
    expect(within(row).queryAllByText("Required")).toHaveLength(expected.isRequired ? 1 : 0);
    expect(within(row).queryAllByText("Secret")).toHaveLength(expected.isSecret ? 1 : 0);
  }

  function setup(input: { askedValues: TemplateAskedValue[] }) {
    return render(<AskedValuesList askedValues={structuredClone(input.askedValues)} />);
  }
});
