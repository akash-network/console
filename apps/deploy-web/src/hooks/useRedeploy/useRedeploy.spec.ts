import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UrlService } from "@src/utils/urlUtils";
import { type DEPENDENCIES, useRedeploy } from "./useRedeploy";

import { renderHook } from "@testing-library/react";

const SECRETS_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN=ac-secret://TOKEN"\n';

describe(useRedeploy.name, () => {
  it("mints a draft from the sdl and opens it in the configure flow, carrying the name", () => {
    const { redeploy, push, createConfigureDraft } = setup({ draftId: "draft-1" });

    redeploy({ sdl: "version: '2.0'", name: "my-app" });

    expect(createConfigureDraft).toHaveBeenCalledWith("version: '2.0'", { name: "my-app" });
    expect(push).toHaveBeenCalledWith("/new-deployment/configure?draftId=draft-1");
  });

  it("names the source deployment on the draft when the sdl references secrets, so the new one can inherit their values", () => {
    const { redeploy, createConfigureDraft } = setup();

    redeploy({ sdl: SECRETS_SDL, name: "my-app", sourceDseq: "123" });

    expect(createConfigureDraft).toHaveBeenCalledWith(SECRETS_SDL, { name: "my-app", inheritSecretsFrom: "123" });
  });

  it("names no source when the sdl references no secret, since there is nothing to inherit", () => {
    const { redeploy, createConfigureDraft } = setup();

    redeploy({ sdl: "version: '2.0'", name: "my-app", sourceDseq: "123" });

    expect(createConfigureDraft).toHaveBeenCalledWith("version: '2.0'", { name: "my-app" });
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
    const createConfigureDraft = vi.fn<typeof DEPENDENCIES.createConfigureDraft>(() => input.draftId ?? "draft-id");
    const dependencies: typeof DEPENDENCIES = {
      useRouter: () => router,
      UrlService,
      createConfigureDraft
    };
    const redeploy = renderHook(() => useRedeploy(dependencies)).result.current;
    return { redeploy, push, createConfigureDraft };
  }
});
