import { createProxy } from "@akashnetwork/react-query-proxy";
import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantActionOf } from "@src/types/assistant";
import type { ApiProviderList } from "@src/types/provider";
import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import { DeploymentLink } from "../DeploymentLink/DeploymentLink";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./ChooseBidCard";
import { ChooseBidCard } from "./ChooseBidCard";

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type Container = ReturnType<typeof DEPENDENCIES.useServices>;
type BidsQuery = ReturnType<typeof DEPENDENCIES.useListBids>;
type BidEntry = NonNullable<BidsQuery["data"]>["data"][number];

describe("ChooseBidCard", () => {
  it("lists the open bids with provider, region, uptime and hourly price, and preselects the recommendation", () => {
    const { chromeProps, useProvidersByAddresses } = setup();

    expect(useProvidersByAddresses).toHaveBeenLastCalledWith(["akash1fast", "akash1other"]);
    const group = screen.getByRole("radiogroup", { name: "Bids for group 1" });
    const recommended = within(group).getByRole("radio", { name: /Fast GPUs/ });
    expect(recommended).toBeChecked();
    expect(within(group).getByText("Recommended")).toBeInTheDocument();
    expect(within(group).getByText("us-west · 99.5% uptime")).toBeInTheDocument();
    expect(within(group).getByRole("radio", { name: /provider\.other\.example/ })).not.toBeChecked();
    expect(within(group).queryByRole("radio", { name: /akash1closed/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/\/hr/)).toHaveLength(2);
    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Choose a provider for blog",
        scope: expect.objectContaining({ type: DeploymentLink, props: { dseq: "42", name: "blog" } }),
        costNote: "Billing starts when the lease starts.",
        confirmLabel: "Start lease",
        isConfirmDisabled: false
      })
    );
  });

  it("starts the lease on the chosen bid the way the deploy flow does", async () => {
    const { chromeProps, createLease, forgetEarlierOutcomes, markOutcomeHandled, queryClient } = setup();
    await userEvent.click(screen.getByRole("radio", { name: /provider\.other\.example/ }));

    await act(() => chromeProps().onConfirm!(""));

    expect(createLease).toHaveBeenCalledWith({ async: "true", leases: [{ dseq: "42", gseq: 1, oseq: 1, provider: "akash1other" }] });
    expect(forgetEarlierOutcomes).toHaveBeenCalledWith("lease_create", "42");
    expect(markOutcomeHandled).not.toHaveBeenCalled();
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listActivities"] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listBids", { dseq: "42" }] });
  });

  it("marks a lease the api started during the request as handled", async () => {
    const { chromeProps, createLease, markOutcomeHandled } = setup();
    createLease.mockResolvedValue({ data: { deployment: {} } });

    await act(() => chromeProps().onConfirm!(""));

    expect(markOutcomeHandled).toHaveBeenCalledWith("lease_create", "42", "succeeded");
  });

  it("marks a refused lease as failed and lets the refusal reach the card", async () => {
    const { chromeProps, createLease, markOutcomeHandled } = setup();
    createLease.mockRejectedValue(new Error("The selected bid is no longer open"));

    await expect(chromeProps().onConfirm!("")).rejects.toThrow("The selected bid is no longer open");
    expect(markOutcomeHandled).toHaveBeenCalledWith("lease_create", "42", "failed");
  });

  it("asks for one bid per group and leases them together", async () => {
    const { chromeProps, createLease } = setup({
      bids: [bidEntry({ provider: "akash1fast", gseq: 1 }), bidEntry({ provider: "akash1other", gseq: 2 })],
      choices: [{ gseq: 1, oseq: 1, provider: "akash1fast", price: { denom: "uact", amount: "1" } }]
    });

    expect(screen.getByText("Group 1")).toBeInTheDocument();
    expect(chromeProps().isConfirmDisabled).toBe(true);

    await userEvent.click(within(screen.getByRole("radiogroup", { name: "Bids for group 2" })).getByRole("radio"));
    expect(chromeProps().isConfirmDisabled).toBe(false);

    await act(() => chromeProps().onConfirm!(""));
    expect(createLease).toHaveBeenCalledWith({
      async: "true",
      leases: [
        { dseq: "42", gseq: 1, oseq: 1, provider: "akash1fast" },
        { dseq: "42", gseq: 2, oseq: 1, provider: "akash1other" }
      ]
    });
  });

  it("names a provider the lookup does not know without showing its address", () => {
    setup({ bids: [bidEntry({ provider: "akash1unlisted" })] });

    expect(screen.getByRole("radio", { name: /Unknown provider/ })).toBeInTheDocument();
    expect(screen.queryByText(/akash1unlisted/)).not.toBeInTheDocument();
  });

  it("shows a provider as being looked up rather than unknown while its lookup is in flight", () => {
    setup({ bids: [bidEntry({ provider: "akash1fast" }), bidEntry({ provider: "akash1unlisted" })], isLookingUpProviders: true });

    expect(screen.getByRole("radio", { name: /Looking up provider…/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Fast GPUs/ })).toBeInTheDocument();
    expect(screen.queryByText(/Unknown provider/)).not.toBeInTheDocument();
  });

  it("can't start a lease on a recommendation that is no longer open", () => {
    const { chromeProps } = setup({ bids: [bidEntry({ provider: "akash1other" })] });

    expect(screen.getByRole("radio", { name: /provider\.other\.example/ })).not.toBeChecked();
    expect(chromeProps().isConfirmDisabled).toBe(true);
  });

  it("says when bids are loading or there are none", () => {
    const loading = setup({ isLoading: true, bids: [] });
    expect(screen.getByText("Loading bids...")).toBeInTheDocument();
    expect(loading.chromeProps().isConfirmDisabled).toBe(true);
    loading.unmount();

    setup({ bids: [] });
    expect(screen.getByText("No open bids right now.")).toBeInTheDocument();
  });

  it("hides the bids once the card is settled", () => {
    setup({ decisionStatus: "succeeded" });

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  function bidEntry(input: { provider: string; gseq?: number; state?: string; amount?: string }): BidEntry {
    return mock<BidEntry>({
      bid: {
        id: { owner: "akash1owner", dseq: "42", gseq: input.gseq ?? 1, oseq: 1, provider: input.provider, bseq: 1 },
        state: input.state ?? "open",
        price: { denom: "uact", amount: input.amount ?? "100" }
      }
    });
  }

  function setup(
    input: {
      bids?: BidEntry[];
      choices?: AssistantActionOf<"choose_bid">["choices"];
      isLoading?: boolean;
      isLookingUpProviders?: boolean;
      decisionStatus?: ActionCardDecision["status"];
    } = {}
  ) {
    const useDeploymentName = vi.fn((_dseq: string | null | undefined, _knownName?: string | null): string | null => "blog");
    const action: AssistantActionOf<"choose_bid"> = {
      type: "choose_bid",
      tier: "confirm",
      dseq: "42",
      choices: input.choices ?? [{ gseq: 1, oseq: 1, provider: "akash1fast", price: { denom: "uact", amount: "100" } }]
    };
    const bids = input.bids ?? [
      bidEntry({ provider: "akash1fast" }),
      bidEntry({ provider: "akash1other" }),
      bidEntry({ provider: "akash1closed", state: "closed" })
    ];
    const createLease = vi.fn<(input: unknown) => Promise<{ data: Record<string, unknown> }>>(async () => ({ data: { activityId: "activity-1" } }));
    const api = createProxy({ v1: { createLease, listActivities: vi.fn(), listBids: vi.fn() } }) as unknown as Container["api"];
    const queryClient = mock<QueryClient>({ invalidateQueries: vi.fn(async () => undefined) });
    const forgetEarlierOutcomes = vi.fn();
    const markOutcomeHandled = vi.fn();
    const providers = [
      mock<ApiProviderList>({ owner: "akash1fast", name: "Fast GPUs", ipRegion: "us-west", uptime7d: 0.995 }),
      mock<ApiProviderList>({ owner: "akash1other", name: null, hostUri: "https://provider.other.example:8443", ipRegion: "eu-west", uptime7d: 0.9 })
    ];
    const useProvidersByAddresses = vi.fn((_addresses: readonly string[]) => ({
      data: providers,
      isLoading: !!input.isLookingUpProviders,
      isFetching: !!input.isLookingUpProviders
    }));
    const ActionCardChrome = vi.fn((props: ActionCardChromeProps) => <>{props.children}</>);
    const decision = mock<ActionCardDecision>({ status: input.decisionStatus ?? "pending" });

    const { unmount } = render(
      <TestContainerProvider>
        <ChooseBidCard
          action={action}
          decision={decision}
          dependencies={{
            useDeploymentName,
            useServices: () => Object.assign(mock<Container>(), { api }),
            useQueryClient: () => queryClient,
            useListBids: () => ({ data: input.isLoading ? undefined : { data: bids }, isLoading: !!input.isLoading }) as unknown as BidsQuery,
            useProvidersByAddresses,
            useMarkActivityOutcomes: () => mock<ReturnType<typeof DEPENDENCIES.useMarkActivityOutcomes>>({ forgetEarlierOutcomes, markOutcomeHandled }),
            ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome,
            PricePerTimeUnit: ({ perBlockValue }) => <span>{perBlockValue}/hr</span>
          }}
        />
      </TestContainerProvider>
    );

    return { useDeploymentName, useProvidersByAddresses, chromeProps: () => ActionCardChrome.mock.lastCall![0], createLease, forgetEarlierOutcomes, markOutcomeHandled, queryClient, unmount };
  }
});
