import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentsPage } from "@src/queries/useDeploymentQuery";
import type { DeploymentDto } from "@src/types/deployment";
import type { DeploymentsCollectionProps } from "./DeploymentsCollection";
import { DEPENDENCIES, DeploymentsList } from "./DeploymentsList";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentsList", () => {
  it("offers a retry when the deployments query fails", async () => {
    const { refetchPage } = setup({ isError: true });

    expect(screen.getByText("Couldn't load deployments.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(refetchPage).toHaveBeenCalled();
  });

  it("renders the onboarding empty state for an account with nothing deployed", () => {
    const { NoDeploymentsState } = setup({ active: [], archived: [] });

    expect(NoDeploymentsState).toHaveBeenCalledWith(expect.objectContaining({ hasDeployments: false, showTemplatesButton: true }), expect.anything());
  });

  it("tells an account whose deployments are all closed that none are active", () => {
    const { NoDeploymentsState } = setup({ active: [], archived: [deployment("200", "closed")] });

    expect(NoDeploymentsState).toHaveBeenCalledWith(expect.objectContaining({ hasDeployments: true, showTemplatesButton: false }), expect.anything());
  });

  it("renders active deployments as a selectable collection", () => {
    const { DeploymentsCollection } = setup({ active: [deployment("100")] });

    expect(DeploymentsCollection).toHaveBeenCalledWith(
      expect.objectContaining({ deployments: [expect.objectContaining({ dseq: "100" })], isSelectable: true }),
      expect.anything()
    );
  });

  it("keeps closed deployments out of the main collection and in the archive", () => {
    const { DeploymentsCollection, DeploymentArchive } = setup({ active: [deployment("100")], archived: [deployment("200", "closed")] });

    expect(DeploymentsCollection).toHaveBeenCalledWith(expect.objectContaining({ deployments: [expect.objectContaining({ dseq: "100" })] }), expect.anything());
    expect(DeploymentArchive).toHaveBeenCalledWith(expect.objectContaining({ deployments: [expect.objectContaining({ dseq: "200" })] }), expect.anything());
  });

  it("starts in the grid view and switches to the list view on demand", async () => {
    const { DeploymentsCollection } = setup({ active: [deployment("100")] });

    expect(DeploymentsCollection).toHaveBeenLastCalledWith(expect.objectContaining({ viewMode: "grid" }), expect.anything());

    await userEvent.click(screen.getByRole("radio", { name: "List view" }));

    expect(DeploymentsCollection).toHaveBeenLastCalledWith(expect.objectContaining({ viewMode: "list" }), expect.anything());
  });

  it("persists the chosen view so it survives a reload", async () => {
    setup({ active: [deployment("100")] });

    await userEvent.click(screen.getByRole("radio", { name: "List view" }));

    expect(localStorage.getItem("deploymentsViewMode")).toBe(JSON.stringify("list"));
  });

  it("does not fetch every deployment until a search is entered", async () => {
    const { useDeploymentList } = setup({ active: [deployment("100")] });

    expect(useDeploymentList).toHaveBeenCalledWith("akash1owner", expect.objectContaining({ enabled: false }), "active");

    await userEvent.type(screen.getByRole("textbox", { name: "Search deployments" }), "acme");

    expect(useDeploymentList).toHaveBeenCalledWith("akash1owner", expect.objectContaining({ enabled: true }), "active");
  });

  it("searches across the archive as well as the active deployments", async () => {
    const { DeploymentArchive } = setup({
      active: [deployment("100")],
      archived: [deployment("200", "closed"), deployment("201", "closed")],
      names: { "200": "acme-old", "201": "other" }
    });

    await userEvent.type(screen.getByRole("textbox", { name: "Search deployments" }), "acme");

    expect(DeploymentArchive).toHaveBeenLastCalledWith(expect.objectContaining({ deployments: [expect.objectContaining({ dseq: "200" })] }), expect.anything());
  });

  it("requests the next offset after Next is clicked", async () => {
    const { useDeploymentsPage } = setup({ active: [deployment("100")], hasNextPage: true });

    await userEvent.click(screen.getByRole("link", { name: "Go to next page" }));

    expect(useDeploymentsPage).toHaveBeenLastCalledWith("akash1owner", expect.objectContaining({ skip: 12, limit: 12, state: "active" }), expect.anything());
  });

  it("closes the selected deployments in one transaction and refreshes the list", async () => {
    const { DeploymentsCollection, signAndBroadcastTx, refetchPage } = setup({ active: [deployment("100")] });

    DeploymentsCollection.mock.lastCall?.[0].onSelect?.({ id: "100", isShiftPressed: false });

    await userEvent.click(await screen.findByRole("button", { name: "Close selected (1)" }));

    expect(signAndBroadcastTx).toHaveBeenCalledWith([expect.anything()]);
    expect(refetchPage).toHaveBeenCalled();
  });

  function deployment(dseq: string, state = "active") {
    return mock<DeploymentDto>({ dseq, state });
  }

  function setup(input: { active?: DeploymentDto[]; archived?: DeploymentDto[]; hasNextPage?: boolean; isError?: boolean; names?: Record<string, string> }) {
    const refetchPage = vi.fn();
    const signAndBroadcastTx = vi.fn().mockResolvedValue({ transactionHash: "0x1" });

    const page: DeploymentsPage = { deployments: input.active ?? [], hasNextPage: input.hasNextPage ?? false };
    const useDeploymentsPage = vi.fn<typeof DEPENDENCIES.useDeploymentsPage>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentsPage>>(), {
        data: page,
        isFetching: false,
        isError: input.isError ?? false,
        refetch: refetchPage
      })
    );

    const useDeploymentList = vi.fn<typeof DEPENDENCIES.useDeploymentList>((_address, _options, state) =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentList>>(), {
        data: state === "closed" ? input.archived ?? [] : input.active ?? [],
        isFetching: false,
        isError: false,
        refetch: vi.fn()
      })
    );

    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1owner", hasWallet: true, signAndBroadcastTx });
    const useProviderList: typeof DEPENDENCIES.useProviderList = () => mock<ReturnType<typeof DEPENDENCIES.useProviderList>>({ data: [], isFetching: false });
    const useBlockchainStatus: typeof DEPENDENCIES.useBlockchainStatus = () =>
      mock<ReturnType<typeof DEPENDENCIES.useBlockchainStatus>>({ isBlockchainDown: false });
    const useLocalNotes: typeof DEPENDENCIES.useLocalNotes = () =>
      mock<ReturnType<typeof DEPENDENCIES.useLocalNotes>>({ getDeploymentName: dseq => input.names?.[String(dseq)] ?? null });
    const useManagedDeploymentConfirm: typeof DEPENDENCIES.useManagedDeploymentConfirm = () =>
      mock<ReturnType<typeof DEPENDENCIES.useManagedDeploymentConfirm>>({ closeDeploymentConfirm: vi.fn().mockResolvedValue(true) });
    const useNewDeploymentUrl: typeof DEPENDENCIES.useNewDeploymentUrl = () => () => "/new-deployment";

    const NoDeploymentsState = vi.fn(() => <div>onboarding empty state</div>);
    const DeploymentsCollection = vi.fn((_props: DeploymentsCollectionProps) => <div>collection</div>);
    const DeploymentArchive = vi.fn(() => <div>archive</div>);

    localStorage.clear();

    const view = render(
      <DeploymentsList
        dependencies={MockComponents(DEPENDENCIES, {
          useWallet,
          useProviderList,
          useBlockchainStatus,
          useLocalNotes,
          useManagedDeploymentConfirm,
          useNewDeploymentUrl,
          useDeploymentsPage,
          useDeploymentList,
          NoDeploymentsState,
          DeploymentsCollection,
          DeploymentArchive
        })}
      />,
      { wrapper: ({ children }) => <Provider store={createStore()}>{children}</Provider> }
    );

    return { ...view, refetchPage, signAndBroadcastTx, useDeploymentsPage, useDeploymentList, NoDeploymentsState, DeploymentsCollection, DeploymentArchive };
  }
});
