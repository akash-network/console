import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UrlService } from "@src/utils/urlUtils";
import { type DEPENDENCIES, useRedeploy } from "./useRedeploy";

import { renderHook } from "@testing-library/react";

describe(useRedeploy.name, () => {
  it("mints a draft from the sdl and opens it in the configure flow, carrying the name", () => {
    const { redeploy, push, createConfigureDraft } = setup({ draftId: "draft-1" });

    redeploy({ sdl: "version: '2.0'", name: "my-app" });

    expect(createConfigureDraft).toHaveBeenCalledWith("version: '2.0'", "my-app");
    expect(push).toHaveBeenCalledWith("/new-deployment/configure?draftId=draft-1");
  });

  it("opens a blank configure screen and mints no draft when no sdl is available", () => {
    const { redeploy, push, createConfigureDraft } = setup();

    redeploy({});

    expect(createConfigureDraft).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/new-deployment/configure");
  });

  function setup(input: { draftId?: string } = {}) {
    const push = vi.fn();
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push });
    const createConfigureDraft = vi.fn(() => input.draftId ?? "draft-id") as unknown as typeof DEPENDENCIES.createConfigureDraft;
    const dependencies: typeof DEPENDENCIES = {
      useRouter: () => router,
      UrlService,
      createConfigureDraft
    };
    const redeploy = renderHook(() => useRedeploy(dependencies)).result.current;
    return { redeploy, push, createConfigureDraft };
  }
});
