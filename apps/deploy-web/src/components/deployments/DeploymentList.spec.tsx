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
    const { NoDeploymentsState } = setup({ data: { deployments: [], total: 0 } });

    expect(NoDeploymentsState).toHaveBeenCalledWith(expect.objectContaining({ hasDeployments: false }), expect.anything());
    expect(screen.queryByText("No closed deployments.")).not.toBeInTheDocument();
  });

  it("renders a closed-specific empty state on the Closed tab", async () => {
    setup({ data: { deployments: [], total: 0 } });

    await userEvent.click(screen.getByRole("tab", { name: "Closed" }));

    expect(screen.getByText("No closed deployments.")).toBeInTheDocument();
  });

  it("keeps rows selectable on Active but not on Closed", async () => {
    setup({ data: { deployments: [mock<DeploymentDto>({ dseq: "100", state: "active" })], total: 3 } });

    expect(screen.getByText("selectable")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Closed" }));

    expect(screen.getByText("not-selectable")).toBeInTheDocument();
  });

  function setup(input: { data?: DeploymentsPage; isFetching?: boolean; isError?: boolean } = {}) {
    const refetch = vi.fn();

    const useDeploymentsPage: typeof DEPENDENCIES.useDeploymentsPage = () => {
      const query = mock<ReturnType<typeof DEPENDENCIES.useDeploymentsPage>>();
      return Object.assign(query, { data: input.data, isFetching: input.isFetching ?? false, isError: input.isError ?? false, refetch });
    };

    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1owner", hasWallet: true });
    const useProviderList: typeof DEPENDENCIES.useProviderList = () => mock<ReturnType<typeof DEPENDENCIES.useProviderList>>({ data: [], isFetching: false });
    const useSettings: typeof DEPENDENCIES.useSettings = () =>
      mock<ReturnType<typeof DEPENDENCIES.useSettings>>({
        isSettingsInit: true,
        settings: mock<ReturnType<typeof DEPENDENCIES.useSettings>["settings"]>({ apiEndpoint: "http://localhost", isBlockchainDown: false })
      });
    const useLocalNotes: typeof DEPENDENCIES.useLocalNotes = () => mock<ReturnType<typeof DEPENDENCIES.useLocalNotes>>();
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

    return { refetch, NoDeploymentsState, DeploymentListRow };
  }
});
