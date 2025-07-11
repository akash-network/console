import "@testing-library/jest-dom";

import React from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import type { RequestFn, RequestFnResponse } from "@openapi-qraft/tanstack-query-react-types";
import { QueryClientProvider } from "@tanstack/react-query";
import merge from "lodash/merge";

import type { ChildrenProps, ContainerInput, Props } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { DeploymentAlertsContainer } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { UAKT_DENOM, USDC_IBC_DENOMS } from "@src/config/denom.config";
import type { usePricing } from "@src/context/PricingProvider";
import { ServicesProvider } from "@src/context/ServicesProvider";
import { queryClient } from "@src/queries";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils";

import { act, render, screen, waitFor } from "@testing-library/react";
import { buildRpcDeployment } from "@tests/seeders/deployment";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";

describe(DeploymentAlertsContainer.name, () => {
  [
    { denom: UAKT_DENOM, threshold: 2000000 },
    { denom: USDC_IBC_DENOMS["mainnet"], threshold: 4000000 }
  ].forEach(({ denom, threshold }) => {
    it(`triggers ${denom} deployment alert request with the correct values`, async () => {
      const { requestFn, input, child, dseq } = await setup({ denom });

      await act(() => child.upsert(input));

      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: "/v1/deployment-alerts/{dseq}"
        }),
        expect.objectContaining({
          parameters: {
            path: { dseq }
          },
          body: {
            data: merge({}, input, {
              alerts: {
                deploymentBalance: {
                  threshold
                }
              }
            })
          }
        })
      );
      await waitFor(() => {
        expect(screen.getByTestId("alert-config-success-notification")).toBeInTheDocument();
      });
    });
  });

  it("shows error notification on failed request", async () => {
    const { requestFn, input, child } = await setup();

    requestFn.mockRejectedValue(new Error("API Error"));

    await act(() => child.upsert(input));

    expect(screen.queryByTestId("alert-config-error-notification")).toBeInTheDocument();
  });

  it("handles deployment closed alert configuration", async () => {
    const { requestFn, child, dseq } = await setup();
    const input: ContainerInput = {
      alerts: {
        deploymentClosed: {
          enabled: true,
          notificationChannelId: buildNotificationChannel().id
        }
      }
    };

    await act(() => child.upsert(input));

    expect(requestFn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        url: "/v1/deployment-alerts/{dseq}"
      }),
      expect.objectContaining({
        parameters: {
          path: { dseq }
        },
        body: {
          data: input
        }
      })
    );
  });

  it("handles escrow balance alert configuration", async () => {
    const { requestFn, child, dseq } = await setup();
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

    expect(requestFn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        url: "/v1/deployment-alerts/{dseq}"
      }),
      expect.objectContaining({
        parameters: {
          path: { dseq }
        },
        body: {
          data: expect.objectContaining({
            alerts: {
              deploymentBalance: expect.objectContaining({
                threshold: expect.any(Number)
              })
            }
          })
        }
      })
    );
  });

  it("handles both deployment closed and balance alerts", async () => {
    const { requestFn, child, dseq } = await setup();
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

    expect(requestFn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        url: "/v1/deployment-alerts/{dseq}"
      }),
      expect.objectContaining({
        parameters: {
          path: { dseq }
        },
        body: {
          data: expect.objectContaining({
            alerts: {
              deploymentClosed: expect.objectContaining({
                enabled: true
              }),
              deploymentBalance: expect.objectContaining({
                enabled: true,
                threshold: expect.any(Number)
              })
            }
          })
        }
      })
    );
  });

  it("provides max balance threshold", async () => {
    const { child } = await setup();

    expect(child.maxBalanceThreshold).toBeGreaterThan(0);
  });

  it("invalidates queries on successful mutation", async () => {
    const { requestFn, input, child } = await setup();
    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    await act(() => child.upsert(input));

    expect(requestFn).toHaveBeenCalled();
    expect(invalidateQueriesSpy).toHaveBeenCalled();
  });

  async function setup({ denom }: { denom?: "uakt" | (typeof USDC_IBC_DENOMS)["mainnet"] | (typeof USDC_IBC_DENOMS)["sandbox"] } = {}) {
    const rpcDeployment = buildRpcDeployment({ denom });
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

    const requestFn = jest.fn(
      () =>
        Promise.resolve({
          data: {
            dseq,
            alerts: {}
          }
        }) as Promise<RequestFnResponse<components["schemas"]["DeploymentAlertsResponse"]["data"], unknown>>
    );

    const services = {
      notificationsApi: () =>
        createAPIClient({
          requestFn: requestFn as RequestFn<any, Error>,
          baseUrl: "",
          queryClient
        })
    };

    const AKT_PRICE = 2;
    const mockPricing = {
      usdToAkt: jest.fn((amount: number) => amount / AKT_PRICE),
      getPriceForDenom: jest.fn((denom: string) => {
        if (denom === "uakt") {
          return AKT_PRICE;
        } else {
          return 1;
        }
      })
    } as unknown as ReturnType<typeof usePricing>;

    const dependencies: NonNullable<Props["dependencies"]> = {
      usePricing: () => mockPricing
    };

    const childCapturer = createContainerTestingChildCapturer<ChildrenProps>();

    render(
      <CustomSnackbarProvider>
        <ServicesProvider services={services}>
          <QueryClientProvider client={queryClient}>
            <DeploymentAlertsContainer deployment={deployment} dependencies={dependencies}>
              {childCapturer.renderChild}
            </DeploymentAlertsContainer>
          </QueryClientProvider>
        </ServicesProvider>
      </CustomSnackbarProvider>
    );

    return { requestFn, input, child: await childCapturer.awaitChild(), dseq };
  }
});
