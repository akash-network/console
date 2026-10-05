import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { resolveSdlSecrets } from "@src/utils/sdl/sdlSecrets";
import type { DeploymentFlow, DeploymentFlowActions } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./useRetryDeploy";
import { useRetryDeploy } from "./useRetryDeploy";

import { act, renderHook } from "@testing-library/react";

const GENERATED_SDL = 'version: "2.0" # generated';

describe(useRetryDeploy.name, () => {
  it("re-fires the deploy with the sealed SDL generated from the current form values and the typed secret values", () => {
    const resolveSdlSecrets = vi.fn(() => ({ references: new Map(), values: { API_KEY: "hunter2" }, unresolved: [] }));
    const { deploy, retry, generateSdl } = setup({ resolveSdlSecrets });

    retry();

    expect(resolveSdlSecrets).toHaveBeenCalledWith(expect.anything(), { sealSecrets: true });

    expect(deploy).toHaveBeenCalledWith(GENERATED_SDL, { secrets: { API_KEY: "hunter2" }, unresolvedSecrets: [] });
    expect(generateSdl).toHaveBeenCalledWith(expect.anything(), { sealSecrets: true });
  });

  it("hands the retry the secrets nothing holds a value for, so the deploy stops instead of leasing them", () => {
    const unresolved = [{ serviceTitle: "web", label: "API_KEY", name: "API_KEY", isKeptReference: false }];
    const { deploy, retry } = setup({
      resolveSdlSecrets: () => ({ references: new Map(), values: {}, unresolved })
    });

    retry();

    expect(deploy).toHaveBeenCalledWith(GENERATED_SDL, { secrets: {}, unresolvedSecrets: unresolved });
  });

  function setup(input: { resolveSdlSecrets?: typeof DEPENDENCIES.resolveSdlSecrets }) {
    const deploy = vi.fn();
    const flow = mock<DeploymentFlow>({ actions: mock<DeploymentFlowActions>({ deploy }) });
    const generateSdl = vi.fn(() => GENERATED_SDL);
    const dependencies: typeof DEPENDENCIES = {
      generateSdl,
      resolveSdlSecrets: input.resolveSdlSecrets ?? resolveSdlSecrets
    };
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm({ defaultValues: { placements: [], services: [] } });
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    const { result } = renderHook(() => useRetryDeploy({ flow }, dependencies), { wrapper: Wrapper });

    return { deploy, generateSdl, retry: () => act(() => result.current()) };
  }
});
