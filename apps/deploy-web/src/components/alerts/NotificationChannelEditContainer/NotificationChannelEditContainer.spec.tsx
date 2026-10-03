import React from "react";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";

import type { ChildrenProps } from "@src/components/alerts/NotificationChannelEditContainer/NotificationChannelEditContainer";
import { NotificationChannelEditContainer } from "@src/components/alerts/NotificationChannelEditContainer/NotificationChannelEditContainer";
import { queryClient } from "@src/queries";
import { createApiSdk } from "@src/services/api-sdk/createApiSdk";

import { act, render, screen } from "@testing-library/react";
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

  it("notifies and calls back only once when re-rendered with a new callback after saving", async () => {
    const { input, child, onEditSuccess, rerenderWithCallback } = await setup();

    child.onEdit(input);
    await vi.waitFor(() => {
      expect(onEditSuccess).toHaveBeenCalledTimes(1);
    });

    const laterCallback = vi.fn();
    rerenderWithCallback(laterCallback);
    await act(() => new Promise(resolve => setTimeout(resolve, 20)));

    expect(laterCallback).not.toHaveBeenCalled();
    expect(onEditSuccess).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId("notification-channel-edit-success-notification")).toHaveLength(1);
  });

  it("calls back once the changes are saved", async () => {
    const { input, child, onEditSuccess } = await setup();

    child.onEdit(input);

    await vi.waitFor(() => {
      expect(onEditSuccess).toHaveBeenCalledTimes(1);
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
    const onEditSuccess = vi.fn();

    const renderWith = (onSuccess: () => void) => (
      <CustomSnackbarProvider>
        <TestContainerProvider services={services}>
          <NotificationChannelEditContainer id={input.id} onEditSuccess={onSuccess}>
            {childCapturer.renderChild}
          </NotificationChannelEditContainer>
        </TestContainerProvider>
      </CustomSnackbarProvider>
    );
    const { rerender } = render(renderWith(onEditSuccess));

    return {
      mockFetch,
      input,
      onEditSuccess,
      rerenderWithCallback: (onSuccess: () => void) => rerender(renderWith(onSuccess)),
      child: await childCapturer.awaitChild()
    };
  }
});
