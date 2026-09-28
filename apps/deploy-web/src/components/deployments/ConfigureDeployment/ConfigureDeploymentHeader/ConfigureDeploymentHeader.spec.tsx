import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { getAvgCostPerMonth } from "@src/utils/priceUtils";
import type { DeploymentCost } from "../useDeploymentCost/useDeploymentCost";
import type { DeploymentFlow, DeploymentFlowActions } from "../useDeploymentFlow/useDeploymentFlow";
import type { QuoteExpiry } from "../useQuoteExpiry/useQuoteExpiry";
import type { DEPENDENCIES } from "./ConfigureDeploymentHeader";
import { ConfigureDeploymentHeader } from "./ConfigureDeploymentHeader";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ConfigureDeploymentHeader.name, () => {
  it("requests quotes through the shared request quotes action", async () => {
    const { requestQuotes } = setup({ phase: "configuring" });

    await userEvent.click(screen.getByRole("button", { name: /request quotes/i }));

    expect(requestQuotes).toHaveBeenCalled();
  });

  it("hands the request quotes action the flow and the name typed for the deployment", () => {
    const { useRequestQuotes, flow } = setup({ phase: "configuring", deploymentName: "my-app" });

    expect(useRequestQuotes).toHaveBeenCalledWith({ flow, deploymentName: "my-app" });
  });

  it("shows each resource of the deployment in the summary", () => {
    setup({ phase: "configuring" });

    expect(screen.getByText("resource summary")).toBeInTheDocument();
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

  it("never shows a cancelling CTA, because cancelling returns the form to configuring at once", () => {
    setup({ phase: "configuring" });
    expect(screen.queryByRole("button", { name: /cancelling/i })).not.toBeInTheDocument();
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
    const { retryDeploy } = setup({
      phase: "quoting",
      allPlacementsHaveBids: true,
      placements: [{ id: "p1" }],
      selections: { p1: "akash1a/1/1/1" },
      deployError: { message: "boom" }
    });
    expect(screen.queryByRole("button", { name: "Deploy" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(retryDeploy).toHaveBeenCalled();
  });

  it("shows a dash for the cost before any bids arrive", () => {
    setup({ phase: "quoting", cost: null });
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByTestId("price")).not.toBeInTheDocument();
    expect(screen.queryByText("/hr")).not.toBeInTheDocument();
  });

  it("shows a single hourly price when the cost bounds are equal", () => {
    setup({ phase: "quoting", cost: { minPerBlock: 5, maxPerBlock: 5, denom: "uakt" } });
    expect(screen.getAllByTestId("price")).toHaveLength(1);
    expect(screen.getByText("/hr")).toBeInTheDocument();
  });

  it("shows a min–max range when the cost bounds differ", () => {
    setup({ phase: "quoting", cost: { minPerBlock: 5, maxPerBlock: 8, denom: "uakt" } });
    expect(screen.getAllByTestId("price")).toHaveLength(2);
    expect(screen.getByText("/hr")).toBeInTheDocument();
  });

  it("shows the cost per month for a CPU-only deployment so a cheap spec doesn't round to $0.00/hr", () => {
    setup({ phase: "quoting", cost: { minPerBlock: 5, maxPerBlock: 5, denom: "uakt" }, hasGpu: false });
    expect(screen.getByText("/month")).toBeInTheDocument();
    expect(screen.queryByText("/hr")).not.toBeInTheDocument();
    expect(screen.getByTestId("price")).toHaveTextContent(String(getAvgCostPerMonth(5)));
  });

  it("passes the sdl and current selections through to the cost hook", () => {
    const { useDeploymentCost } = setup({
      phase: "quoting",
      sdl: "the-sdl",
      selections: { p1: "akash1a/1/1/1" },
      placements: [{ id: "p1" }]
    });
    expect(useDeploymentCost).toHaveBeenCalledWith(expect.objectContaining({ sdl: "the-sdl", selections: { p1: "akash1a/1/1/1" } }));
  });

  it("shows the quote-expiry countdown once bids arrive", () => {
    setup({ phase: "quoting", cost: { minPerBlock: 5, maxPerBlock: 5, denom: "uakt" }, expiry: { secondsLeft: 165, isExpired: false } });
    expect(screen.getByTestId("quote-expiry")).toHaveTextContent("expires in 2:45");
    expect(screen.getByTestId("quote-expiry")).toHaveClass("text-muted-foreground");
  });

  it("marks the countdown red in the final minute", () => {
    setup({ phase: "quoting", cost: { minPerBlock: 5, maxPerBlock: 5, denom: "uakt" }, expiry: { secondsLeft: 45, isExpired: false } });
    expect(screen.getByTestId("quote-expiry")).toHaveTextContent("expires in 0:45");
    expect(screen.getByTestId("quote-expiry")).toHaveClass("text-destructive");
  });

  it("hides the countdown until the first bid arrives", () => {
    setup({ phase: "quoting", expiry: null });
    expect(screen.queryByTestId("quote-expiry")).not.toBeInTheDocument();
  });

  it('keeps the expiry line as "expired" once the window elapses rather than hiding it or showing 0:00', () => {
    setup({ phase: "quoting", cost: null, expiry: { secondsLeft: 0, isExpired: true } });
    const line = screen.getByTestId("quote-expiry");
    expect(line).toHaveTextContent("expired");
    expect(line).not.toHaveTextContent("0:00");
    expect(line).toHaveClass("text-destructive");
  });

  it("does not offer Close and Edit while open bids remain, even after the indicative timer elapses", () => {
    setup({
      phase: "quoting",
      allPlacementsHaveBids: true,
      placements: [{ id: "p1" }],
      selections: { p1: "akash1a/1/1/1" },
      cost: { minPerBlock: 5, maxPerBlock: 5, denom: "uakt" },
      expiry: { secondsLeft: 0, isExpired: true }
    });
    expect(screen.queryByRole("button", { name: "Close and Edit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deploy" })).toBeInTheDocument();
  });

  it("flips the CTA to Close and Edit once the window elapses and no open bids remain, and runs cancelAndEdit", async () => {
    const cancelAndEdit = vi.fn();
    setup({ phase: "quoting", cost: null, expiry: { secondsLeft: 0, isExpired: true }, cancelAndEdit });
    expect(screen.queryByRole("button", { name: /requesting/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close and Edit" }));
    expect(cancelAndEdit).toHaveBeenCalled();
  });

  function setup(input: {
    phase: DeploymentFlow["phase"];
    placements?: { id: string }[];
    selections?: Record<string, string>;
    onDeploy?: () => void;
    allPlacementsHaveBids?: boolean;
    deployError?: { message?: string };
    cost?: DeploymentCost | null;
    hasGpu?: boolean;
    sdl?: string;
    expiry?: QuoteExpiry | null;
    cancelAndEdit?: () => void;
    deploymentName?: string;
  }) {
    const flow = mock<DeploymentFlow>({
      phase: input.phase,
      dseq: null,
      deployError: input.deployError,
      actions: mock<DeploymentFlowActions>({ cancelAndEdit: input.cancelAndEdit ?? vi.fn() })
    });
    flow.selections = input.selections ?? {};
    const useDeploymentCost = vi.fn(() => input.cost ?? null);
    const requestQuotes = vi.fn();
    const retryDeploy = vi.fn();
    const useRequestQuotes = vi.fn(() => requestQuotes);
    const dependencies: typeof DEPENDENCIES = {
      DeploymentResourceSummary: () => <span>resource summary</span>,
      useDeploymentHasGpu: () => input.hasGpu ?? true,
      useRequestQuotes,
      useRetryDeploy: () => retryDeploy,
      useDeploymentCost: useDeploymentCost as typeof DEPENDENCIES.useDeploymentCost,
      PriceValue: ({ value }) => <span data-testid="price">{String(value)}</span>,
      useQuoteExpiry: () => input.expiry ?? null,
      CustomTooltip: ({ children }) => <>{children}</>
    };
    render(
      <Wrapper placements={input.placements}>
        <ConfigureDeploymentHeader
          flow={flow}
          sdl={input.sdl ?? ""}
          deploymentName={input.deploymentName ?? ""}
          onDeploy={input.onDeploy ?? vi.fn()}
          allPlacementsHaveBids={input.allPlacementsHaveBids ?? false}
          dependencies={dependencies}
        />
      </Wrapper>
    );
    return { flow, useDeploymentCost, useRequestQuotes, requestQuotes, retryDeploy };
  }

  function Wrapper({ children, placements }: { children: ReactNode; placements?: { id: string }[] }) {
    const form = useForm({ defaultValues: { placements: placements ?? [], services: [] } });
    return <FormProvider {...form}>{children}</FormProvider>;
  }
});
