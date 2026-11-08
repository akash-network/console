import type { PropsWithChildren } from "react";
import { createElement } from "react";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { deployTargetProjectIdAtom } from "@src/store/deployTargetStore";
import { UrlService } from "@src/utils/urlUtils";
import { type DEPENDENCIES, useSaveAsTemplate } from "./useSaveAsTemplate";

import { renderHook } from "@testing-library/react";

const SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN=ac-secret://TOKEN"\n';

describe(useSaveAsTemplate.name, () => {
  it("opens template mode on a draft of the deployment's SDL", () => {
    const { saveAsTemplate, push, createConfigureDraft } = setup({ draftId: "draft-1" });

    saveAsTemplate({ sdl: SDL, name: "my-app", dseq: "123" });

    expect(createConfigureDraft).toHaveBeenCalledWith(SDL, { name: "my-app" });
    expect(push).toHaveBeenCalledWith("/new-deployment/configure?templateMode=new&draftId=draft-1&sourceDseq=123");
  });

  it("keeps secrets as references, naming no deployment to inherit their values from", () => {
    const { saveAsTemplate, createConfigureDraft } = setup();

    saveAsTemplate({ sdl: SDL, name: "my-app", dseq: "123" });

    expect(createConfigureDraft.mock.lastCall?.[1]).not.toHaveProperty("inheritSecretsFrom");
  });

  it("names no source deployment when the SDL comes from the assistant", () => {
    const { saveAsTemplate, push } = setup({ draftId: "draft-1" });

    saveAsTemplate({ sdl: SDL, name: "Site" });

    expect(push).toHaveBeenCalledWith("/new-deployment/configure?templateMode=new&draftId=draft-1");
  });

  it("files the template in the project of the deployment it is saved from", () => {
    const { saveAsTemplate, store } = setup({ rememberedProjectId: "project-a" });

    saveAsTemplate({ sdl: SDL, projectId: "project-b" });

    expect(store.get(deployTargetProjectIdAtom)).toBe("project-b");
  });

  it("leaves the project to the picker when the deployment's project is unknown", () => {
    const { saveAsTemplate, store } = setup({ rememberedProjectId: "project-a" });

    saveAsTemplate({ sdl: SDL, projectId: null });

    expect(store.get(deployTargetProjectIdAtom)).toBeNull();
  });

  function setup(input: { draftId?: string; rememberedProjectId?: string } = {}) {
    const push = vi.fn();
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push });
    const createConfigureDraft = vi.fn<typeof DEPENDENCIES.createConfigureDraft>(() => input.draftId ?? "draft-id");
    const dependencies: typeof DEPENDENCIES = {
      useRouter: () => router,
      UrlService,
      createConfigureDraft
    };
    const store = createStore();
    if (input.rememberedProjectId) store.set(deployTargetProjectIdAtom, input.rememberedProjectId);
    const saveAsTemplate = renderHook(() => useSaveAsTemplate(dependencies), {
      wrapper: ({ children }: PropsWithChildren) => createElement(Provider, { store }, children)
    }).result.current;
    return { saveAsTemplate, push, createConfigureDraft, store };
  }
});
