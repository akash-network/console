import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./AutoDeployFlow";
import { AutoDeployFlow } from "./AutoDeployFlow";

import { render } from "@testing-library/react";
import { ComponentMock } from "@tests/unit/mocks";

type ContainerProps = Parameters<typeof DEPENDENCIES.PhasedDeploymentContainer>[0];

describe(AutoDeployFlow.name, () => {
  it("drives the phased container with trial readiness, the resolved SDL, and the resumed dseq", () => {
    const PhasedDeploymentContainer = vi.fn(ComponentMock);
    const trialError = new Error("trial failed");
    setup({
      templateName: "Hello World",
      sdl: "sdl-content",
      dseq: "555",
      trial: { isWalletReady: true, error: trialError },
      dependencies: { PhasedDeploymentContainer }
    });

    expect(PhasedDeploymentContainer).toHaveBeenCalledWith(
      expect.objectContaining({ templateName: "Hello World", sdl: "sdl-content", isWalletReady: true, trialError, initialDseq: "555" }),
      expect.anything()
    );
  });

  it("writes the created dseq into the URL preserving the auto intent", () => {
    const replace = vi.fn();
    const { containerProps } = setup({ templateId: "hello-world", draftId: "d1", router: { replace } });

    containerProps().onDeploymentCreated?.("777");

    expect(replace).toHaveBeenCalledWith(
      UrlService.configureDeployment({ dseq: "777", templateId: "hello-world", sdlStrategy: "default", bidStrategy: "auto", draftId: "d1" }),
      undefined,
      { shallow: true }
    );
  });

  it("redirects to the deployment details and toasts on success", () => {
    const replace = vi.fn();
    const enqueueSnackbar = vi.fn();
    const { containerProps } = setup({ router: { replace }, enqueueSnackbar });

    containerProps().onSuccess?.("777");

    expect(enqueueSnackbar).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith(UrlService.deploymentDetails("777"));
  });

  it("returns to manual configuration of the same template when the flow is cancelled", () => {
    const replace = vi.fn();
    const { containerProps } = setup({ templateId: "hello-world", router: { replace } });

    containerProps().onCancel?.();

    expect(replace).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: "hello-world", sdlStrategy: "default" }));
  });

  function setup(
    input: {
      templateName?: string;
      sdl?: string;
      templateId?: string;
      dseq?: string;
      draftId?: string;
      trial?: { isWalletReady?: boolean; error?: unknown };
      router?: { replace?: ReturnType<typeof vi.fn> };
      enqueueSnackbar?: ReturnType<typeof vi.fn>;
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const PhasedDeploymentContainer = input.dependencies?.PhasedDeploymentContainer ?? vi.fn(ComponentMock);

    const useRouter: typeof DEPENDENCIES.useRouter = () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace: input.router?.replace ?? vi.fn() });
    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () =>
      mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar: input.enqueueSnackbar ?? vi.fn() });
    // Built as a plain object (not mock<T>) so the passed-through trialError stays referentially intact rather than deep-mocked.
    const useEnsureTrialStarted: typeof DEPENDENCIES.useEnsureTrialStarted = () =>
      ({ isWalletReady: input.trial?.isWalletReady ?? true, isLoading: false, error: input.trial?.error, refreshWallet: vi.fn() }) as ReturnType<
        typeof DEPENDENCIES.useEnsureTrialStarted
      >;

    render(
      <AutoDeployFlow
        templateName={input.templateName ?? "Hello World"}
        sdl={input.sdl ?? "sdl-content"}
        templateId={input.templateId}
        dseq={input.dseq}
        draftId={input.draftId}
        dependencies={{
          Layout: ComponentMock,
          Snackbar: ComponentMock,
          PhasedDeploymentContainer,
          useRouter,
          useSnackbar,
          useEnsureTrialStarted,
          ...input.dependencies
        }}
      />
    );

    return { containerProps: () => (PhasedDeploymentContainer as ReturnType<typeof vi.fn>).mock.calls[0][0] as ContainerProps };
  }
});
