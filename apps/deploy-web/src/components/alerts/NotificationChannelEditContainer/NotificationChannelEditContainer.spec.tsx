import React from "react";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";

import type { ChildrenProps } from "@src/components/alerts/NotificationChannelEditContainer/NotificationChannelEditContainer";
import { NotificationChannelEditContainer } from "@src/components/alerts/NotificationChannelEditContainer/NotificationChannelEditContainer";
import { queryClient } from "@src/queries";
import { createApiSdk } from "@src/services/api-sdk/createApiSdk";

import { render, screen } from "@testing-library/react";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";
import { jsonResponse } from "@tests/unit/jsonResponse";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe("NotificationChannelEditContainer", () => {
  it("triggers notification channel patch endpoint with the correct values", async () => {
    const { mockFetch, input, child } = await setup();

    child.onEdit(input);

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/v1/notification-channels/${input.id}`),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            data: {
              name: input.name,
              config: {
                addresses: input.emails
              }
            }
          })
        })
      );
      expect(screen.getByTestId("notification-channel-edit-success-notification")).toBeInTheDocument();
    });
  });

  it("triggers notification channel patch endpoint and shows error message on error", async () => {
    const { mockFetch, input, child } = await setup();

    mockFetch.mockRejectedValue(new Error());

    child.onEdit(input);

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(`/v1/notification-channels/${input.id}`), expect.objectContaining({ method: "PATCH" }));
      expect(screen.getByTestId("notification-channel-edit-error-notification")).toBeInTheDocument();
    });
  });

  async function setup() {
    const input = {
      id: faker.string.uuid(),
      name: faker.lorem.word(),
      emails: [faker.internet.email()]
    };
    const mockFetch = vi.fn(() => Promise.resolve(jsonResponse(buildNotificationChannel(input))));
    const services = {
      queryClient: () => queryClient,
      api: () => createProxy(createApiSdk({ baseUrl: "", fetch: mockFetch }))
    };
    const childCapturer = createContainerTestingChildCapturer<ChildrenProps>();

    render(
      <CustomSnackbarProvider>
        <TestContainerProvider services={services}>
          <NotificationChannelEditContainer id={input.id} onEditSuccess={vi.fn()}>
            {childCapturer.renderChild}
          </NotificationChannelEditContainer>
        </TestContainerProvider>
      </CustomSnackbarProvider>
    );

    return { mockFetch, input, child: await childCapturer.awaitChild() };
  }
});
