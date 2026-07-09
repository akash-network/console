import type { ReactNode } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UrlService } from "@src/utils/urlUtils";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import { buildConfigureUrl } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES, ResumeResolution } from "./ResumeDeploymentGuard";
import { ResumeDeploymentGuard } from "./ResumeDeploymentGuard";

import { render, screen } from "@testing-library/react";

const PROVIDER = "akash1provider";

describe(ResumeDeploymentGuard.name, () => {
  it("renders a fresh start immediately when there is no dseq to resume", () => {
    const { getResume, replace } = setup({ intent: intentFor(undefined) });

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(getResume()).toEqual({ activeLeases: [] });
    expect(replace).not.toHaveBeenCalled();
  });

  it("holds the children behind a spinner while the deployment resolves", () => {
    setup({ intent: intentFor("555"), query: { isLoading: true } });

    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("strips the dseq and toasts when the resumed deployment no longer exists", () => {
    const intent = intentFor("555");
    const { replace, enqueueSnackbar } = setup({ intent, query: { error: new ApiError(404, { message: "Deployment not found" }, "GET → 404") } });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
    expect(replace).toHaveBeenCalledWith(buildConfigureUrl(intent, undefined, intent.bidStrategy));
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("renders a fresh start once the dseq has been stripped from the URL", () => {
    const { rerender, getResume } = setup({ intent: intentFor("555"), query: { error: new ApiError(404, {}, "GET → 404") } });

    rerender(intentFor(undefined));

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(getResume()).toEqual({ activeLeases: [] });
  });

  it("keeps rendering the fresh start after a not-found resume when a new deployment repopulates the dseq", () => {
    const { rerender, getResume } = setup({ intent: intentFor("555"), query: { error: new ApiError(404, {}, "GET → 404") } });

    // The URL clears (dseq stripped), then the fresh flow creates a new deployment and writes a dseq back. The guard has
    // latched a fresh start, so it must keep rendering the children rather than snapping back to the spinner.
    rerender(intentFor(undefined));
    rerender(intentFor("999"));

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(getResume()).toEqual({ activeLeases: [] });
  });

  it("resumes best-effort without stripping the dseq on a transient (non-404) error", () => {
    const { getResume, replace } = setup({ intent: intentFor("555"), query: { error: new ApiError(500, {}, "GET → 500") } });

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(getResume()).toEqual({ activeLeases: [] });
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to the detail page when the resumed deployment is closed", () => {
    const { replace } = setup({ intent: intentFor("555"), query: deployment({ state: "closed" }) });

    expect(replace).toHaveBeenCalledWith(UrlService.deploymentDetails("555"));
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("resumes quoting from scratch when the open deployment has no live leases", () => {
    const { getResume, replace } = setup({
      intent: intentFor("555"),
      query: deployment({ state: "active", leases: [{ id: { dseq: "555", gseq: 1, oseq: 1, provider: PROVIDER }, state: "closed" }] })
    });

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(getResume()).toEqual({ activeLeases: [] });
    expect(replace).not.toHaveBeenCalled();
  });

  it("reconstructs the live leases so the flow can re-send the manifest when it can resume", () => {
    const { getResume, replace } = setup({
      intent: intentFor("555"),
      canResume: true,
      query: deployment({
        state: "active",
        leases: [
          { id: { dseq: "555", gseq: 1, oseq: 2, provider: PROVIDER }, state: "active" },
          { id: { dseq: "555", gseq: 2, oseq: 1, provider: PROVIDER }, state: "closed" }
        ]
      })
    });

    expect(getResume()).toEqual({ activeLeases: [{ dseq: "555", gseq: 1, oseq: 2, provider: PROVIDER }] });
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects an already-leased deployment to the detail page when it cannot resume", () => {
    const { replace } = setup({
      intent: intentFor("555"),
      canResume: false,
      query: deployment({ state: "active", leases: [{ id: { dseq: "555", gseq: 1, oseq: 1, provider: PROVIDER }, state: "active" }] })
    });

    expect(replace).toHaveBeenCalledWith(UrlService.deploymentDetails("555"));
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  function intentFor(dseq: string | undefined): DeploymentIntent {
    return { sdlStrategy: "edit", bidStrategy: "select", dseq };
  }

  function deployment(input: { state: string; leases?: unknown[] }) {
    return { data: { data: { deployment: { state: input.state }, leases: input.leases ?? [] } } };
  }

  function setup(input: {
    intent: DeploymentIntent;
    canResume?: boolean;
    query?: { isLoading?: boolean; isError?: boolean; error?: unknown; data?: unknown };
  }) {
    const replace = vi.fn();
    const enqueueSnackbar = vi.fn();
    let resume: ResumeResolution | undefined;

    // react-query's result is a discriminated union on isError/isSuccess that a plain mock<T> partial can't express,
    // so the hand-built result is cast rather than fighting the union.
    const useGetDeployment = vi.fn(
      () =>
        ({
          data: input.query?.data,
          isLoading: input.query?.isLoading ?? false,
          isError: input.query?.error !== undefined,
          error: input.query?.error
        }) as unknown as ReturnType<typeof DEPENDENCIES.useGetDeployment>
    );

    const dependencies: typeof DEPENDENCIES = {
      Layout: vi.fn(({ children }: { children: ReactNode }) => <div data-testid="layout-mock">{children}</div>) as never,
      useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace })) as never,
      useSnackbar: (() => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })) as never,
      Snackbar: vi.fn(() => null) as never,
      useGetDeployment: useGetDeployment as never
    };

    const renderChild = (r: ResumeResolution) => {
      resume = r;
      return <div data-testid="child" />;
    };

    const view = render(
      <ResumeDeploymentGuard intent={input.intent} canResume={input.canResume ?? false} dependencies={dependencies}>
        {renderChild}
      </ResumeDeploymentGuard>
    );

    return {
      replace,
      enqueueSnackbar,
      getResume: () => resume,
      rerender: (intent: DeploymentIntent) =>
        view.rerender(
          <ResumeDeploymentGuard intent={intent} canResume={input.canResume ?? false} dependencies={dependencies}>
            {renderChild}
          </ResumeDeploymentGuard>
        )
    };
  }
});
