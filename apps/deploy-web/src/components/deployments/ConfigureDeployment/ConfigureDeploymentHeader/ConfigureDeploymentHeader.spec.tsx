import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Snackbar } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentFlow, DeploymentFlowActions } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./ConfigureDeploymentHeader";
import { ConfigureDeploymentHeader } from "./ConfigureDeploymentHeader";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** Stand-in for the SDL the header regenerates from the submitted form values. */
const GENERATED_SDL = 'version: "2.0" # generated';

describe(ConfigureDeploymentHeader.name, () => {
  it("requests quotes with the SDL generated from the submitted form values, not a stale snapshot", async () => {
    const requestQuotes = vi.fn();
    const { enqueueSnackbar } = setup({ phase: "configuring", requestQuotes });

    fireEvent.click(screen.getByRole("button", { name: /request quotes/i }));

    await waitFor(() => expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL));
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("surfaces SDL validation errors and does not request quotes when the spec is invalid", async () => {
    const requestQuotes = vi.fn();
    const { enqueueSnackbar } = setup({
      phase: "configuring",
      requestQuotes,
      validationErrors: ["/services/web/params/tee: missing required property 'gpu'"]
    });

    fireEvent.click(screen.getByRole("button", { name: /request quotes/i }));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledTimes(1));
    expect(requestQuotes).not.toHaveBeenCalled();

    render(enqueueSnackbar.mock.calls[0][0] as ReactNode);
    expect(screen.getByText("/services/web/params/tee: missing required property 'gpu'")).toBeInTheDocument();
  });

  it("shows a disabled Requesting CTA while creating", () => {
    setup({ phase: "creating" });
    const cta = screen.getByRole("button", { name: /requesting/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toBeDisabled();
    expect(screen.queryByRole("button", { name: /request quotes/i })).not.toBeInTheDocument();
  });

  it("shows Request quotes while configuring", () => {
    setup({ phase: "configuring" });
    expect(screen.getByRole("button", { name: /request quotes/i })).toBeInTheDocument();
  });

  it("keeps the Requesting CTA while closing", () => {
    setup({ phase: "closing" });
    expect(screen.getByRole("button", { name: /requesting/i })).toBeInTheDocument();
  });

  it("restores Request quotes after an error so the spec can be retried", () => {
    setup({ phase: "error" });
    expect(screen.getByRole("button", { name: /request quotes/i })).toBeInTheDocument();
  });

  it("keeps the Requesting CTA while quoting until the first bid arrives", () => {
    setup({ phase: "quoting", allPlacementsHaveBids: false, placements: [{ id: "p1" }], selections: {} });
    expect(screen.getByRole("button", { name: /requesting/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deploy" })).not.toBeInTheDocument();
  });

  it("shows Deploy disabled until every placement has a selection", () => {
    setup({ phase: "quoting", allPlacementsHaveBids: true, placements: [{ id: "p1" }, { id: "p2" }], selections: { p1: "akash1a/1/1/1" } });
    expect(screen.getByRole("button", { name: "Deploy" })).toBeDisabled();
  });

  it("enables Deploy when all placements are selected and calls onDeploy", async () => {
    const onDeploy = vi.fn();
    setup({ phase: "quoting", allPlacementsHaveBids: true, placements: [{ id: "p1" }], selections: { p1: "akash1a/1/1/1" }, onDeploy });
    const deploy = screen.getByRole("button", { name: "Deploy" });
    expect(deploy).toBeEnabled();
    await userEvent.click(deploy);
    expect(onDeploy).toHaveBeenCalled();
  });

  it("shows Retry instead of Deploy after a failed deploy and re-fires the deploy request", async () => {
    const deploy = vi.fn();
    setup({
      phase: "quoting",
      allPlacementsHaveBids: true,
      placements: [{ id: "p1" }],
      selections: { p1: "akash1a/1/1/1" },
      deployError: { message: "boom" },
      deploy
    });
    expect(screen.queryByRole("button", { name: "Deploy" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(deploy).toHaveBeenCalled();
  });

  function setup(input: {
    phase: DeploymentFlow["phase"];
    requestQuotes?: (sdl: string) => void;
    validationErrors?: string[];
    placements?: { id: string }[];
    selections?: Record<string, string>;
    onDeploy?: () => void;
    allPlacementsHaveBids?: boolean;
    deployError?: { message?: string };
    deploy?: () => void;
  }) {
    const flow = mock<DeploymentFlow>({
      phase: input.phase,
      dseq: null,
      deployError: input.deployError,
      actions: mock<DeploymentFlowActions>({ requestQuotes: input.requestQuotes ?? vi.fn(), deploy: input.deploy ?? vi.fn() })
    });
    flow.selections = input.selections ?? {};
    const enqueueSnackbar = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useDeploymentResourceSummary: (() => "1 vCPU") as never,
      useSnackbar: () => mock<ReturnType<(typeof DEPENDENCIES)["useSnackbar"]>>({ enqueueSnackbar }),
      Snackbar,
      generateSdl: () => GENERATED_SDL,
      validateGeneratedSdl: () => input.validationErrors ?? []
    };
    render(
      <Wrapper placements={input.placements}>
        <ConfigureDeploymentHeader
          flow={flow}
          onDeploy={input.onDeploy ?? vi.fn()}
          allPlacementsHaveBids={input.allPlacementsHaveBids ?? false}
          dependencies={dependencies}
        />
      </Wrapper>
    );
    return { enqueueSnackbar };
  }

  function Wrapper({ children, placements }: { children: ReactNode; placements?: { id: string }[] }) {
    const form = useForm({ defaultValues: { placements: placements ?? [] } });
    return <FormProvider {...form}>{children}</FormProvider>;
  }
});
