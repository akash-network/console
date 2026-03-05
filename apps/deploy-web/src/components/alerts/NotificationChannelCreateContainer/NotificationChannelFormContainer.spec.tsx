import React from "react";
import { type components, createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { faker } from "@faker-js/faker";
import type { RequestFn, RequestFnResponse } from "@openapi-qraft/tanstack-query-react-types";
import { describe, expect, it, vi } from "vitest";

import type { ChildrenProps } from "@src/components/alerts/NotificationChannelCreateContainer/NotificationChannelCreateContainer";
import { NotificationChannelCreateContainer } from "@src/components/alerts/NotificationChannelCreateContainer/NotificationChannelCreateContainer";
import { queryClient } from "@src/queries";

import { render, screen } from "@testing-library/react";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe("NotificationChannelCreateContainer", () => {
  it("triggers a notification channel creation with the correct values", async () => {
    const { requestFn, input, child } = await setup();

    child.create(input);

    await vi.waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: "/v1/notification-channels"
        }),
        expect.objectContaining({
          body: {
            data: {
              config: {
                addresses: input.emails
              },
              name: input.name,
              type: "email"
            }
          }
        })
      );
      expect(screen.getByTestId("notification-channel-create-success-notification")).toBeInTheDocument();
    });
  });

  it("triggers a notification channel creation and shows error message on error", async () => {
    const { requestFn, input, child } = await setup();

    child.create(input);

    requestFn.mockRejectedValue(new Error());

    await vi.waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: "/v1/notification-channels"
        }),
        expect.objectContaining({
          body: {
            data: {
              config: {
                addresses: input.emails
              },
              name: input.name,
              type: "email"
            }
          }
        })
      );
      expect(screen.getByTestId("notification-channel-create-error-notification")).toBeInTheDocument();
    });
  });

  async function setup() {
    const input = {
      name: faker.lorem.word(),
      emails: [faker.internet.email()]
    };
    const requestFn = vi.fn(
      () =>
        Promise.resolve({
          data: {
            config: {
              addresses: input.emails
            },
            name: input.name,
            type: "email",
            userId: faker.string.uuid()
          }
        }) as Promise<RequestFnResponse<components["schemas"]["NotificationChannelOutput"]["data"], unknown>>
    );
    const services = {
      queryClient: () => queryClient,
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
        <TestContainerProvider services={services}>
          <NotificationChannelCreateContainer onCreate={vi.fn()}>{childCapturer.renderChild}</NotificationChannelCreateContainer>
        </TestContainerProvider>
      </CustomSnackbarProvider>
    );

    return { requestFn, input, child: await childCapturer.awaitChild() };
  }
});
