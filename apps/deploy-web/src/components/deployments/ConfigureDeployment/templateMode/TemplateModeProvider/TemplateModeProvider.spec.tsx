import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";

import type { TemplateAskedValue } from "@src/types/marketplace-template";
import { defaultService } from "@src/utils/sdl/data";
import { buildAskedValues } from "../buildAskedValues";
import { TemplateModeProvider, useTemplateMode } from "./TemplateModeProvider";

import { act, renderHook } from "@testing-library/react";

describe(TemplateModeProvider.name, () => {
  it("answers null outside template mode", () => {
    const { result } = renderHook(() => useTemplateMode());

    expect(result.current).toBeNull();
  });

  it("starts with the template's asked values asked and nothing to save", () => {
    const { result } = setup({
      initialAskedValues: [
        { key: "PORT", label: "Port", type: "number", default: "80", integer: true, required: false, bindings: [{ service: "web", env: "PORT" }] },
        { key: "HF_TOKEN", label: "HF token", type: "secret", required: true, bindings: [{ service: "web", env: "HF_TOKEN" }] }
      ]
    });

    expect(result.current?.settings).toEqual({
      PORT: { key: "PORT", isAsked: true, customized: {} },
      HF_TOKEN: { key: "HF_TOKEN", isAsked: true, customized: {} }
    });
    expect(result.current?.isDirty).toBe(false);
  });

  it("keeps as customized every field that differs from the guess", () => {
    const { result } = setup({
      initialAskedValues: [
        {
          key: "LITELLM_MODEL",
          label: "Model",
          help: "Which model LiteLLM serves.",
          type: "choice",
          choices: ["gpt-4o-mini", "gpt-4o"],
          default: "gpt-4o-mini",
          required: true,
          bindings: [{ service: "litellm", env: "LITELLM_MODEL" }]
        },
        { key: "WORKERS", label: "Workers", type: "number", default: "1.5", min: 1, max: 8, integer: true, required: false, bindings: [] },
        { key: "COUNT", label: "Count", type: "number", default: "2", required: false, bindings: [] },
        { key: "NAME", label: "Name", type: "text", default: "acme", minLength: 2, maxLength: 40, required: false, bindings: [] },
        { key: "DEBUG", label: "Debug", type: "boolean", required: false, bindings: [] },
        { key: "SIZE", label: "Size", type: "number", integer: true, required: true, bindings: [] }
      ]
    });

    expect(result.current?.settings).toEqual({
      LITELLM_MODEL: {
        key: "LITELLM_MODEL",
        isAsked: true,
        customized: { label: "Model", help: "Which model LiteLLM serves.", type: "choice", choices: ["gpt-4o-mini", "gpt-4o"], required: true }
      },
      WORKERS: { key: "WORKERS", isAsked: true, customized: { min: 1, max: 8, integer: true } },
      COUNT: { key: "COUNT", isAsked: true, customized: { integer: false } },
      NAME: { key: "NAME", isAsked: true, customized: { minLength: 2, maxLength: 40 } },
      DEBUG: { key: "DEBUG", isAsked: true, customized: { type: "boolean", required: false } },
      SIZE: { key: "SIZE", isAsked: true, customized: { type: "number", integer: true } }
    });
  });

  it("rebuilds the template's asked values unchanged from the rows they were saved from", () => {
    const initialAskedValues: TemplateAskedValue[] = [
      {
        key: "API_BASE",
        label: "API base",
        type: "text",
        default: "http://litellm:4000/v1",
        required: false,
        bindings: [
          { service: "webui", env: "API_BASE" },
          { service: "litellm", env: "API_BASE" }
        ]
      },
      {
        key: "SITE_NAME",
        label: "Site name",
        help: "Shown in the header.",
        type: "text",
        maxLength: 40,
        required: true,
        bindings: [{ service: "webui", env: "SITE_NAME" }]
      },
      { key: "DEBUG", label: "Debug", type: "boolean", default: "false", required: false, bindings: [{ service: "webui", env: "DEBUG" }] },
      {
        key: "LITELLM_MODEL",
        label: "Model",
        help: "Which model LiteLLM serves.",
        type: "choice",
        choices: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
        default: "gpt-4o-mini",
        required: true,
        bindings: [{ service: "litellm", env: "LITELLM_MODEL" }]
      },
      {
        key: "WORKERS",
        label: "Workers",
        type: "number",
        default: "2",
        min: 1,
        max: 8,
        integer: true,
        required: false,
        bindings: [{ service: "litellm", env: "WORKERS" }]
      },
      {
        key: "TEMPERATURE",
        label: "Temperature",
        type: "number",
        default: "0.7",
        integer: false,
        required: false,
        bindings: [{ service: "litellm", env: "TEMPERATURE" }]
      },
      { key: "HF_TOKEN", label: "Hugging Face token", type: "secret", required: true, bindings: [{ service: "litellm", env: "HF_TOKEN" }] }
    ];
    const services = [
      defaultService("placement", {
        title: "webui",
        env: [
          { id: "1", key: "API_BASE", value: "http://litellm:4000/v1", isSecret: false },
          { id: "2", key: "SITE_NAME", value: "", isSecret: false },
          { id: "3", key: "DEBUG", value: "false", isSecret: false },
          { id: "4", key: "LOG_LEVEL", value: "info", isSecret: false }
        ]
      }),
      defaultService("placement", {
        title: "litellm",
        env: [
          { id: "5", key: "API_BASE", value: "http://litellm:4000/v1", isSecret: false },
          { id: "6", key: "LITELLM_MODEL", value: "gpt-4o-mini", isSecret: false },
          { id: "7", key: "WORKERS", value: "2", isSecret: false },
          { id: "8", key: "TEMPERATURE", value: "0.7", isSecret: false },
          { id: "9", key: "HF_TOKEN", value: "ac-secret://HF_TOKEN", isSecret: true }
        ]
      })
    ];
    const { result } = setup({ initialAskedValues });

    expect(buildAskedValues(services, result.current?.settings ?? {})).toEqual(initialAskedValues);
  });

  it("asks and stops asking a key, marking the template unsaved until it is saved", () => {
    const { result } = setup({ initialAskedValues: [] });

    act(() => result.current?.setAsked("LOG_LEVEL", true));
    expect(result.current?.settings.LOG_LEVEL).toEqual({ key: "LOG_LEVEL", isAsked: true, customized: {} });
    expect(result.current?.isDirty).toBe(true);

    act(() => result.current?.markSaved());
    expect(result.current?.isDirty).toBe(false);

    act(() => result.current?.setAsked("LOG_LEVEL", false));
    expect(result.current?.settings.LOG_LEVEL).toEqual({ key: "LOG_LEVEL", isAsked: false, customized: {} });
    expect(result.current?.isDirty).toBe(true);
  });

  it("merges a customization into what was customized before", () => {
    const { result } = setup({ initialAskedValues: [] });

    act(() => result.current?.customize("MODEL", { label: "Model" }));
    act(() => result.current?.customize("MODEL", { help: "Pick one" }));

    expect(result.current?.settings.MODEL).toEqual({ key: "MODEL", isAsked: false, customized: { label: "Model", help: "Pick one" } });
    expect(result.current?.isDirty).toBe(true);
  });

  it("keeps a __proto__ key as a setting of its own", () => {
    const { result } = setup({
      initialAskedValues: [{ key: "__proto__", label: "Prototype", type: "text", default: "x", required: false, bindings: [] }]
    });

    act(() => result.current?.setAsked("constructor", true));
    act(() => result.current?.customize("__proto__", { help: "Odd key" }));

    const settings = result.current?.settings ?? {};
    expect(Object.keys(settings)).toEqual(["__proto__", "constructor"]);
    expect(Object.getOwnPropertyDescriptor(settings, "__proto__")?.value).toEqual({
      key: "__proto__",
      isAsked: true,
      customized: { label: "Prototype", help: "Odd key" }
    });
    expect(Object.getPrototypeOf(settings)).toBeNull();
  });

  function setup(input: { initialAskedValues: TemplateAskedValue[] }) {
    const initialAskedValues = structuredClone(input.initialAskedValues);
    const wrapper = ({ children }: PropsWithChildren) => <TemplateModeProvider initialAskedValues={initialAskedValues}>{children}</TemplateModeProvider>;
    return renderHook(() => useTemplateMode(), { wrapper });
  }
});
