import "@testing-library/jest-dom";

import React from "react";
import { type components, createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { faker } from "@faker-js/faker";
import type { RequestFn, RequestFnResponse } from "@openapi-qraft/tanstack-query-react-types";
import { QueryClientProvider } from "@tanstack/react-query";

import type { ChildrenProps, ContainerInput } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { DeploymentAlertsContainer } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { ServicesProvider } from "@src/context/ServicesProvider";
import { queryClient } from "@src/queries";

import { render, screen, waitFor } from "@testing-library/react";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";

describe("DeploymentAlertsContainer", () => {
  it("triggers a deployment alert request with the correct values", async () => {
    const { requestFn, input, child, dseq } = await setup();

    child.upsert(input);

    await waitFor(() => {
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
      expect(screen.getByTestId("alert-config-success-notification")).toBeInTheDocument();
    });
  });

  it("shows error notification on failed request", async () => {
    const { requestFn, input, child, dseq } = await setup();

    requestFn.mockRejectedValue(new Error());

    child.upsert(input);

    await waitFor(() => {
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
      expect(screen.getByTestId("alert-config-error-notification")).toBeInTheDocument();
    });
  });

  async function setup() {
    const dseq = faker.string.numeric();
    const input: ContainerInput = {
      alerts: {
        deploymentClosed: {
          enabled: true,
          notificationChannelId: faker.string.uuid()
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
    const childCapturer = createContainerTestingChildCapturer<ChildrenProps>();

    render(
      <CustomSnackbarProvider>
        <ServicesProvider services={services}>
          <QueryClientProvider client={queryClient}>
            <DeploymentAlertsContainer dseq={dseq}>{childCapturer.renderChild}</DeploymentAlertsContainer>
          </QueryClientProvider>
        </ServicesProvider>
      </CustomSnackbarProvider>
    );

    return { requestFn, input, child: await childCapturer.awaitChild(), dseq };
  }
});
