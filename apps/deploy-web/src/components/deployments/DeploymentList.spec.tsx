import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentsPage } from "@src/queries/useDeploymentQuery";
import type { DeploymentDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentList } from "./DeploymentList";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(DeploymentList.name, () => {
  it("renders an error state with a retry when the page query fails", async () => {
    const { refetch } = setup({ isError: true });

    expect(screen.getByText("Couldn't load deployments.")).toBeInTheDocument();

    const callsBeforeRetry = refetch.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
  });

  it("renders the onboarding empty state when there are no active deployments", () => {
    const { NoDeploymentsState } = setup({ data: { deployments: [], hasNextPage: false } });

    expect(NoDeploymentsState).toHaveBeenCalledWith(expect.objectContaining({ hasDeployments: false }), expect.anything());
    expect(screen.queryByText("No closed deployments.")).not.toBeInTheDocument();
  });

  it("renders a closed-specific empty state on the Closed tab", async () => {
    setup({ data: { deployments: [], hasNextPage: false } });

    await userEvent.click(screen.getByRole("tab", { name: "Closed" }));

    expect(screen.getByText("No closed deployments.")).toBeInTheDocument();
  });

  it("keeps rows selectable on Active but not on Closed", async () => {
    setup({ data: { deployments: [mock<DeploymentDto>({ dseq: "100", state: "active" })], hasNextPage: false } });

    expect(screen.getByText("selectable")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Closed" }));

    expect(screen.getByText("not-selectable")).toBeInTheDocument();
  });

  it("does not force a refetch on initial load since the query is already enabled", () => {
    const { refetch } = setup({ data: { deployments: [], hasNextPage: false } });

    expect(refetch).not.toHaveBeenCalled();
  });

  it("enables Next when the RPC reports a next_key and keeps Previous disabled on the first page", () => {
    setup({ data: { deployments: [mock<DeploymentDto>({ dseq: "100", state: "active" })], hasNextPage: true } });

    expect(screen.getByRole("link", { name: "Go to next page" })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Go to previous page" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
  });

  it("disables Next on the last page", () => {
    setup({ data: { deployments: [mock<DeploymentDto>({ dseq: "100", state: "active" })], hasNextPage: false } });

    expect(screen.getByRole("link", { name: "Go to next page" })).toHaveAttribute("aria-disabled", "true");
  });

  it("requests the next offset after Next is clicked", async () => {
    const { useDeploymentsPage } = setup({
      data: { deployments: [mock<DeploymentDto>({ dseq: "100", state: "active" })], hasNextPage: true }
    });

    await userEvent.click(screen.getByRole("link", { name: "Go to next page" }));

    expect(useDeploymentsPage).toHaveBeenLastCalledWith("akash1owner", expect.objectContaining({ skip: 10, limit: 10, state: "active" }), expect.anything());
    expect(screen.getByRole("link", { name: "Go to previous page" })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("does not fetch the full state list until a search is entered", () => {
    const { useDeploymentList } = setup({ data: { deployments: [mock<DeploymentDto>({ dseq: "100", state: "active" })], hasNextPage: false } });

    expect(useDeploymentList).toHaveBeenLastCalledWith("akash1owner", expect.objectContaining({ enabled: false }), "active");
  });

  it("searches the full selected-state list, including deployments not on the current page", async () => {
    setup({
      data: { deployments: [mock<DeploymentDto>({ dseq: "100", state: "active" })], hasNextPage: true },
      list: [mock<DeploymentDto>({ dseq: "100", state: "active" }), mock<DeploymentDto>({ dseq: "999", state: "active" })]
    });

    expect(screen.queryByText("999")).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox"), "999");

    expect(screen.getByText("999")).toBeInTheDocument();
    expect(screen.queryByText("100")).not.toBeInTheDocument();
  });

  it("matches a local deployment name from the full selected-state list", async () => {
    setup({
      data: { deployments: [mock<DeploymentDto>({ dseq: "100", state: "active" })], hasNextPage: false },
      list: [mock<DeploymentDto>({ dseq: "100", state: "active" }), mock<DeploymentDto>({ dseq: "200", state: "active" })],
      getDeploymentName: dseq => (String(dseq) === "200" ? "staging-api" : null)
    });

    await userEvent.type(screen.getByRole("textbox"), "staging");

    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.queryByText("100")).not.toBeInTheDocument();
  });

  it("scopes the full-list search to the Closed tab when that tab is selected", async () => {
    const { useDeploymentList } = setup({
      data: { deployments: [mock<DeploymentDto>({ dseq: "100", state: "active" })], hasNextPage: false },
      list: [mock<DeploymentDto>({ dseq: "300", state: "closed" })]
    });

    await userEvent.click(screen.getByRole("tab", { name: "Closed" }));
    await userEvent.type(screen.getByRole("textbox"), "300");

    expect(useDeploymentList).toHaveBeenLastCalledWith("akash1owner", expect.objectContaining({ enabled: true }), "closed");
    expect(screen.getByText("300")).toBeInTheDocument();
  });

  it("paginates filtered search results when they exceed the page size", async () => {
    const list = Array.from({ length: 11 }, (_, index) => mock<DeploymentDto>({ dseq: `match-${index}`, state: "active" }));
    setup({
      data: { deployments: [list[0]], hasNextPage: true },
      list
    });

    await userEvent.type(screen.getByRole("textbox"), "match");

    expect(screen.getByText("match-0")).toBeInTheDocument();
    expect(screen.queryByText("match-10")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to next page" })).not.toHaveAttribute("aria-disabled", "true");

    await userEvent.click(screen.getByRole("link", { name: "Go to next page" }));

    expect(screen.getByText("match-10")).toBeInTheDocument();
    expect(screen.queryByText("match-0")).not.toBeInTheDocument();
  });

  it("renders the closed empty state when the search box contains only whitespace", async () => {
    setup({
      data: { deployments: [mock<DeploymentDto>({ dseq: "100", state: "active" })], hasNextPage: false },
      closedData: { deployments: [], hasNextPage: false }
    });

    await userEvent.type(screen.getByRole("textbox"), " ");
    await userEvent.click(screen.getByRole("tab", { name: "Closed" }));

    expect(screen.getByText("No closed deployments.")).toBeInTheDocument();
    expect(screen.queryByText("No deployment found.")).not.toBeInTheDocument();
  });

  it("renders no deployment found when a search matches nothing", async () => {
    setup({
      data: { deployments: [mock<DeploymentDto>({ dseq: "100", state: "active" })], hasNextPage: false },
      list: []
    });

    await userEvent.type(screen.getByRole("textbox"), "nomatch");

    expect(screen.getByText("No deployment found.")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load deployments.")).not.toBeInTheDocument();
  });

  it("does not render the search-empty message when the search query fails", async () => {
    setup({
      data: { deployments: [mock<DeploymentDto>({ dseq: "100", state: "active" })], hasNextPage: false },
      isListError: true
    });

    await userEvent.type(screen.getByRole("textbox"), "foo");

    expect(screen.getByText("Couldn't load deployments.")).toBeInTheDocument();
    expect(screen.queryByText("No deployment found.")).not.toBeInTheDocument();
  });

  function setup(
    input: {
      data?: DeploymentsPage;
      closedData?: DeploymentsPage;
      list?: DeploymentDto[];
      isFetching?: boolean;
      isError?: boolean;
      isListError?: boolean;
      getDeploymentName?: (dseq: string | number | null) => string | null;
    } = {}
  ) {
    const refetch = vi.fn();
    const refetchList = vi.fn();

    const useDeploymentsPage = vi.fn<typeof DEPENDENCIES.useDeploymentsPage>((_address, params) => {
      const query = mock<ReturnType<typeof DEPENDENCIES.useDeploymentsPage>>();
      const data = params.state === "closed" && input.closedData !== undefined ? input.closedData : input.data;
      return Object.assign(query, { data, isFetching: input.isFetching ?? false, isError: input.isError ?? false, refetch });
    });

    const useDeploymentList = vi.fn<typeof DEPENDENCIES.useDeploymentList>(() => {
      const query = mock<ReturnType<typeof DEPENDENCIES.useDeploymentList>>();
      return Object.assign(query, { data: input.list, isFetching: false, isError: input.isListError ?? false, refetch: refetchList });
    });

    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1owner", hasWallet: true });
    const useProviderList: typeof DEPENDENCIES.useProviderList = () => mock<ReturnType<typeof DEPENDENCIES.useProviderList>>({ data: [], isFetching: false });
    const useSettings: typeof DEPENDENCIES.useSettings = () =>
      mock<ReturnType<typeof DEPENDENCIES.useSettings>>({
        isSettingsInit: true,
        settings: mock<ReturnType<typeof DEPENDENCIES.useSettings>["settings"]>({ apiEndpoint: "http://localhost", isBlockchainDown: false })
      });
    const useLocalNotes: typeof DEPENDENCIES.useLocalNotes = () =>
      mock<ReturnType<typeof DEPENDENCIES.useLocalNotes>>({
        getDeploymentName: input.getDeploymentName ?? (() => null)
      });
    const useManagedDeploymentConfirm: typeof DEPENDENCIES.useManagedDeploymentConfirm = () =>
      mock<ReturnType<typeof DEPENDENCIES.useManagedDeploymentConfirm>>();
    const useNewDeploymentUrl: typeof DEPENDENCIES.useNewDeploymentUrl = () => () => "/new-deployment";

    const NoDeploymentsState = vi.fn(() => <div>onboarding empty state</div>);
    const DeploymentListRow = vi.fn(({ deployment, isSelectable }: { deployment: DeploymentDto; isSelectable?: boolean }) => (
      <tr>
        <td>{deployment.dseq}</td>
        <td>{isSelectable ? "selectable" : "not-selectable"}</td>
      </tr>
    ));

    render(
      <DeploymentList
        dependencies={MockComponents(DEPENDENCIES, {
          useDeploymentsPage,
          useDeploymentList,
          useWallet,
          useProviderList,
          useSettings,
          useLocalNotes,
          useManagedDeploymentConfirm,
          useNewDeploymentUrl,
          NoDeploymentsState,
          DeploymentListRow
        })}
      />
    );

    return { refetch, NoDeploymentsState, DeploymentListRow, useDeploymentsPage, useDeploymentList };
  }
});
