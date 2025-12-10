import "@testing-library/jest-dom";

import React from "react";
import { type components, createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { faker } from "@faker-js/faker";
import type { RequestFnResponse } from "@openapi-qraft/react/src/lib/requestFn";

import type { ChildrenProps } from "@src/components/alerts/NotificationChannelEditContainer/NotificationChannelEditContainer";
import { NotificationChannelEditContainer } from "@src/components/alerts/NotificationChannelEditContainer/NotificationChannelEditContainer";
import { queryClient } from "@src/queries";

import { render, screen, waitFor } from "@testing-library/react";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe("NotificationChannelEditContainer", () => {
  it("triggers notification channel patch endpoint with the correct values", async () => {
    const { requestFn, input, child } = await setup();

    child.onEdit(input);

    await waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "patch",
          url: "/v1/notification-channels/{id}"
        }),
        expect.objectContaining({
          body: {
            data: {
              config: {
                addresses: input.emails
              },
              name: input.name
            }
          },
          parameters: {
            path: {
              id: input.id
            }
          }
        })
      );
      expect(screen.getByTestId("notification-channel-edit-success-notification")).toBeInTheDocument();
    });
  });

  it("triggers notification channel patch endpoint and shows error message on error", async () => {
    const { requestFn, input, child } = await setup();

    requestFn.mockRejectedValue(new Error());

    child.onEdit(input);

    await waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "patch",
          url: "/v1/notification-channels/{id}"
        }),
        expect.objectContaining({
          body: {
            data: {
              config: {
                addresses: input.emails
              },
              name: input.name
            }
          },
          parameters: {
            path: {
              id: input.id
            }
          }
        })
      );
      expect(screen.getByTestId("notification-channel-edit-error-notification")).toBeInTheDocument();
    });
  });

  async function setup() {
    const input = {
      id: faker.string.uuid(),
      name: faker.lorem.word(),
      emails: [faker.internet.email()]
    };
    const requestFn = jest.fn(
      () =>
        Promise.resolve({
          data: buildNotificationChannel(input)
        }) as Promise<RequestFnResponse<components["schemas"]["NotificationChannelOutput"]["data"], unknown>>
    );
    const services = {
      queryClient: () => queryClient,
      notificationsApi: () =>
        createAPIClient({
          requestFn,
          baseUrl: "",
          queryClient
        })
    };
    const childCapturer = createContainerTestingChildCapturer<ChildrenProps>();

    render(
      <CustomSnackbarProvider>
        <TestContainerProvider services={services}>
          <NotificationChannelEditContainer id={input.id} onEditSuccess={jest.fn()}>
            {childCapturer.renderChild}
          </NotificationChannelEditContainer>
        </TestContainerProvider>
      </CustomSnackbarProvider>
    );

    return { requestFn, input, child: await childCapturer.awaitChild() };
  }
});
