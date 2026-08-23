import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Snackbar } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { getAvgCostPerMonth } from "@src/utils/priceUtils";
import type { DeploymentCost } from "../useDeploymentCost/useDeploymentCost";
import type { DeploymentFlow, DeploymentFlowActions } from "../useDeploymentFlow/useDeploymentFlow";
import type { QuoteExpiry } from "../useQuoteExpiry/useQuoteExpiry";
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

  it("blocks a trial deployment whose GPU resolves to a blocked selection and surfaces the trial message", async () => {
    const requestQuotes = vi.fn();
    const { enqueueSnackbar } = setup({
      phase: "configuring",
      requestQuotes,
      isRestricted: true,
      services: [{ profile: { hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "" }] } }]
    });

    fireEvent.click(screen.getByRole("button", { name: /request quotes/i }));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledTimes(1));
    expect(requestQuotes).not.toHaveBeenCalled();

    render(enqueueSnackbar.mock.calls[0][0] as ReactNode);
    expect(screen.getByText(/GPU access is not available on a free trial/i)).toBeInTheDocument();
  });

  it("lets a trial deployment on an allowed specific GPU model request quotes", async () => {
    const requestQuotes = vi.fn();
    setup({
      phase: "configuring",
      requestQuotes,
      isRestricted: true,
      services: [{ profile: { hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "t4" }] } }]
    });

    fireEvent.click(screen.getByRole("button", { name: /request quotes/i }));

    await waitFor(() => expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL));
  });

  it("does not apply the trial GPU guard for a non-trial user", async () => {
    const requestQuotes = vi.fn();
    setup({
      phase: "configuring",
      requestQuotes,
      isRestricted: false,
      services: [{ profile: { hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "" }] } }]
    });

    fireEvent.click(screen.getByRole("button", { name: /request quotes/i }));

    await waitFor(() => expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL));
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

  it("shows a Cancelling CTA while closing", () => {
    setup({ phase: "closing" });
    expect(screen.getByRole("button", { name: /cancelling/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /requesting/i })).not.toBeInTheDocument();
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
    requestQuotes?: (sdl: string) => void;
    validationErrors?: string[];
    placements?: { id: string }[];
    selections?: Record<string, string>;
    onDeploy?: () => void;
    allPlacementsHaveBids?: boolean;
    deployError?: { message?: string };
    deploy?: () => void;
    cost?: DeploymentCost | null;
    hasGpu?: boolean;
    sdl?: string;
    expiry?: QuoteExpiry | null;
    cancelAndEdit?: () => void;
    isRestricted?: boolean;
    services?: Array<{ profile: { hasGpu?: boolean; gpuModels?: Array<{ vendor: string; name?: string }> } }>;
  }) {
    const flow = mock<DeploymentFlow>({
      phase: input.phase,
      dseq: null,
      deployError: input.deployError,
      actions: mock<DeploymentFlowActions>({
        requestQuotes: input.requestQuotes ?? vi.fn(),
        deploy: input.deploy ?? vi.fn(),
        cancelAndEdit: input.cancelAndEdit ?? vi.fn()
      })
    });
    flow.selections = input.selections ?? {};
    const enqueueSnackbar = vi.fn();
    const useDeploymentCost = vi.fn(() => input.cost ?? null);
    const dependencies: typeof DEPENDENCIES = {
      useDeploymentResourceSummary: (() => "1 vCPU") as never,
      useDeploymentHasGpu: () => input.hasGpu ?? true,
      useSnackbar: () => mock<ReturnType<(typeof DEPENDENCIES)["useSnackbar"]>>({ enqueueSnackbar }),
      Snackbar,
      generateSdl: () => GENERATED_SDL,
      validateGeneratedSdl: () => input.validationErrors ?? [],
      useDeploymentCost: useDeploymentCost as typeof DEPENDENCIES.useDeploymentCost,
      PriceValue: ({ value }) => <span data-testid="price">{String(value)}</span>,
      useQuoteExpiry: () => input.expiry ?? null,
      CustomTooltip: ({ children }) => <>{children}</>,
      useTrialGate: () => ({ isRestricted: input.isRestricted ?? false, isWalletReady: true })
    };
    render(
      <Wrapper placements={input.placements} services={input.services}>
        <ConfigureDeploymentHeader
          flow={flow}
          sdl={input.sdl ?? ""}
          onDeploy={input.onDeploy ?? vi.fn()}
          allPlacementsHaveBids={input.allPlacementsHaveBids ?? false}
          dependencies={dependencies}
        />
      </Wrapper>
    );
    return { enqueueSnackbar, useDeploymentCost };
  }

  function Wrapper({
    children,
    placements,
    services
  }: {
    children: ReactNode;
    placements?: { id: string }[];
    services?: Array<{ profile: { hasGpu?: boolean; gpuModels?: Array<{ vendor: string; name?: string }> } }>;
  }) {
    const form = useForm({ defaultValues: { placements: placements ?? [], services: services ?? [] } });
    return <FormProvider {...form}>{children}</FormProvider>;
  }
});
