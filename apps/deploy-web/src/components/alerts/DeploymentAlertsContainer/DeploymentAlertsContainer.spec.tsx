import React from "react";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import merge from "lodash/merge";
import { describe, expect, it, vi } from "vitest";

import type { ChildrenProps, ContainerInput } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { DeploymentAlertsContainer } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { USDC_IBC_DENOMS } from "@src/config/denom.config";
import { queryClient } from "@src/queries";
import { createApiSdk } from "@src/services/api-sdk/createApiSdk";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils";

import { act, render, screen } from "@testing-library/react";
import { buildRpcDeployment } from "@tests/seeders/deployment";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";
import { jsonResponse } from "@tests/unit/jsonResponse";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(DeploymentAlertsContainer.name, () => {
  it("triggers deployment alert request with the correct values", async () => {
    const { mockFetch, input, child, dseq } = await setup();

    await act(() => child.upsert(input));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/v1/deployment-alerts/${dseq}`),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          data: merge({}, input, {
            alerts: {
              deploymentBalance: {
                threshold: 4000000
              }
            }
          })
        })
      })
    );
    await vi.waitFor(() => {
      expect(screen.getByTestId("alert-config-success-notification")).toBeInTheDocument();
    });
  });

  it("shows error notification on failed request", async () => {
    const { mockFetch, input, child } = await setup();

    mockFetch.mockRejectedValue(new Error("API Error"));

    await act(() => child.upsert(input));

    expect(screen.queryByTestId("alert-config-error-notification")).toBeInTheDocument();
  });

  it("handles deployment closed alert configuration", async () => {
    const { mockFetch, child, dseq } = await setup();
    const input: ContainerInput = {
      alerts: {
        deploymentClosed: {
          enabled: true,
          notificationChannelId: buildNotificationChannel().id
        }
      }
    };

    await act(() => child.upsert(input));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/v1/deployment-alerts/${dseq}`),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ data: input })
      })
    );
  });

  it("handles escrow balance alert configuration", async () => {
    const { mockFetch, child, dseq } = await setup();
    const input: ContainerInput = {
      alerts: {
        deploymentBalance: {
          enabled: true,
          threshold: 100,
          notificationChannelId: buildNotificationChannel().id
        }
      }
    };

    await act(() => child.upsert(input));

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(`/v1/deployment-alerts/${dseq}`), expect.objectContaining({ method: "POST" }));
  });

  it("handles both deployment closed and balance alerts", async () => {
    const { mockFetch, child, dseq } = await setup();
    const input: ContainerInput = {
      alerts: {
        deploymentClosed: {
          enabled: true,
          notificationChannelId: buildNotificationChannel().id
        },
        deploymentBalance: {
          enabled: true,
          threshold: 50,
          notificationChannelId: buildNotificationChannel().id
        }
      }
    };

    await act(() => child.upsert(input));

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(`/v1/deployment-alerts/${dseq}`), expect.objectContaining({ method: "POST" }));
  });

  it("provides max balance threshold", async () => {
    const { child } = await setup();

    expect(child.maxBalanceThreshold).toBeGreaterThan(0);
  });

  it("invalidates queries on successful mutation", async () => {
    const { mockFetch, input, child } = await setup();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    await act(() => child.upsert(input));

    expect(mockFetch).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalled();
    });
  });

  async function setup() {
    const rpcDeployment = buildRpcDeployment({
      denom: USDC_IBC_DENOMS["mainnet"],
      escrow_account: { state: { funds: [{ denom: USDC_IBC_DENOMS["mainnet"], amount: "5000000.000000000000000000" }] } }
    });
    const deployment = deploymentToDto(rpcDeployment);
    const dseq = deployment.dseq;
    const input: ContainerInput = {
      alerts: {
        deploymentClosed: {
          enabled: true,
          notificationChannelId: buildNotificationChannel().id
        },
        deploymentBalance: {
          enabled: true,
          notificationChannelId: buildNotificationChannel().id,
          threshold: 4
        }
      }
    };

    const mockFetch = vi.fn(() => Promise.resolve(jsonResponse({ dseq, alerts: {} })));

    const services = {
      queryClient: () => queryClient,
      api: () => createProxy(createApiSdk({ baseUrl: "", fetch: mockFetch }))
    };

    const childCapturer = createContainerTestingChildCapturer<ChildrenProps>();

    render(
      <CustomSnackbarProvider>
        <TestContainerProvider services={services}>
          <DeploymentAlertsContainer deployment={deployment}>{childCapturer.renderChild}</DeploymentAlertsContainer>
        </TestContainerProvider>
      </CustomSnackbarProvider>
    );

    return { mockFetch, input, child: await childCapturer.awaitChild(), dseq };
  }
});
