import React from "react";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";

import type { ChildrenProps } from "@src/components/alerts/NotificationChannelCreateContainer/NotificationChannelCreateContainer";
import { NotificationChannelCreateContainer } from "@src/components/alerts/NotificationChannelCreateContainer/NotificationChannelCreateContainer";
import { queryClient } from "@src/queries";
import { createApiSdk } from "@src/services/api-sdk/createApiSdk";

import { render, screen } from "@testing-library/react";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";
import { jsonResponse } from "@tests/unit/jsonResponse";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe("NotificationChannelCreateContainer", () => {
  it("triggers a notification channel creation with the correct values", async () => {
    const { mockFetch, input, child } = await setup();

    child.create(input);

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/notification-channels"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            data: {
              name: input.name,
              type: "email",
              config: {
                addresses: input.emails
              }
            }
          })
        })
      );
      expect(screen.getByTestId("notification-channel-create-success-notification")).toBeInTheDocument();
    });
  });

  it("triggers a notification channel creation and shows error message on error", async () => {
    const { mockFetch, input, child } = await setup();

    mockFetch.mockRejectedValue(new Error());

    child.create(input);

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/v1/notification-channels"), expect.objectContaining({ method: "POST" }));
      expect(screen.getByTestId("notification-channel-create-error-notification")).toBeInTheDocument();
    });
  });

  async function setup() {
    const input = {
      name: faker.lorem.word(),
      emails: [faker.internet.email()]
    };
    const mockResponse = {
      data: {
        config: {
          addresses: input.emails
        },
        name: input.name,
        type: "email",
        userId: faker.string.uuid()
      }
    };
    const mockFetch = vi.fn(() => Promise.resolve(jsonResponse(mockResponse)));
    const services = {
      queryClient: () => queryClient,
      api: () => createProxy(createApiSdk({ baseUrl: "", fetch: mockFetch }))
    };
    const childCapturer = createContainerTestingChildCapturer<ChildrenProps>();

    render(
      <CustomSnackbarProvider>
        <TestContainerProvider services={services}>
          <NotificationChannelCreateContainer onCreate={vi.fn()}>{childCapturer.renderChild}</NotificationChannelCreateContainer>
        </TestContainerProvider>
      </CustomSnackbarProvider>
    );

    return { mockFetch, input, child: await childCapturer.awaitChild() };
  }
});
