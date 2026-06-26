import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Snackbar } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./ConfigureDeploymentHeader";
import { ConfigureDeploymentHeader } from "./ConfigureDeploymentHeader";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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

  it("keeps the Requesting CTA while quoting", () => {
    setup({ phase: "quoting" });
    expect(screen.getByRole("button", { name: /requesting/i })).toBeInTheDocument();
  });

  it("keeps the Requesting CTA while closing", () => {
    setup({ phase: "closing" });
    expect(screen.getByRole("button", { name: /requesting/i })).toBeInTheDocument();
  });

  it("restores Request quotes after an error so the spec can be retried", () => {
    setup({ phase: "error" });
    expect(screen.getByRole("button", { name: /request quotes/i })).toBeInTheDocument();
  });

  function setup(input: { phase: DeploymentFlow["phase"]; requestQuotes?: (sdl: string) => void; validationErrors?: string[] }) {
    const flow = mock<DeploymentFlow>({
      phase: input.phase,
      actions: mock<DeploymentFlow["actions"]>({ requestQuotes: input.requestQuotes ?? vi.fn() })
    });
    const enqueueSnackbar = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useDeploymentResourceSummary: (() => "1 vCPU") as never,
      useSnackbar: () => mock<ReturnType<(typeof DEPENDENCIES)["useSnackbar"]>>({ enqueueSnackbar }),
      Snackbar,
      generateSdl: () => GENERATED_SDL,
      validateGeneratedSdl: () => input.validationErrors ?? []
    };
    render(
      <Wrapper>
        <ConfigureDeploymentHeader flow={flow} dependencies={dependencies} />
      </Wrapper>
    );
    return { enqueueSnackbar };
  }

  function Wrapper({ children }: { children: ReactNode }) {
    const form = useForm();
    return <FormProvider {...form}>{children}</FormProvider>;
  }
});
