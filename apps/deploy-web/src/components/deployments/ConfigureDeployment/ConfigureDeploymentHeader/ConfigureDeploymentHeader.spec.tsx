import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./ConfigureDeploymentHeader";
import { ConfigureDeploymentHeader } from "./ConfigureDeploymentHeader";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

describe(ConfigureDeploymentHeader.name, () => {
  it("shows Request quotes while configuring and calls requestQuotes", async () => {
    const requestQuotes = vi.fn();
    setup({ phase: "configuring", requestQuotes });
    fireEvent.click(screen.getByRole("button", { name: /request quotes/i }));
    await waitFor(() => expect(requestQuotes).toHaveBeenCalled());
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

  function setup(input: { phase: DeploymentFlow["phase"]; requestQuotes?: () => void }) {
    const flow = mock<DeploymentFlow>({
      phase: input.phase,
      actions: mock<DeploymentFlow["actions"]>({ requestQuotes: input.requestQuotes ?? vi.fn() })
    });
    const dependencies: typeof DEPENDENCIES = { useDeploymentResourceSummary: (() => "1 vCPU") as never };
    return render(
      <Wrapper>
        <ConfigureDeploymentHeader flow={flow} dependencies={dependencies} />
      </Wrapper>
    );
  }

  function Wrapper({ children }: { children: ReactNode }) {
    const form = useForm();
    return <FormProvider {...form}>{children}</FormProvider>;
  }
});
