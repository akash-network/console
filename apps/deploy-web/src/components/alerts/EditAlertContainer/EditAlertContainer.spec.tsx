import React from "react";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";

import type { ChildrenProps } from "@src/components/alerts/EditAlertContainer/EditAlertContainer";
import { EditAlertContainer } from "@src/components/alerts/EditAlertContainer/EditAlertContainer";
import { queryClient } from "@src/queries";
import { createApiSdk } from "@src/services/api-sdk/createApiSdk";

import { render, screen } from "@testing-library/react";
import { buildWalletBalanceAlert } from "@tests/seeders/alert";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";
import { jsonResponse } from "@tests/unit/jsonResponse";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(EditAlertContainer.name, () => {
  it("patches the alert with the submitted values", async () => {
    const { mockFetch, id, input, child } = await setup();

    child.onEdit(input);

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/v1/alerts/${id}`),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ data: input })
        })
      );
      expect(screen.getByTestId("alert-edit-success-notification")).toBeInTheDocument();
    });
  });

  it("shows an error notification when the patch fails", async () => {
    const { mockFetch, id, input, child } = await setup();

    mockFetch.mockRejectedValue(new Error());

    child.onEdit(input);

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(`/v1/alerts/${id}`), expect.objectContaining({ method: "PATCH" }));
      expect(screen.getByTestId("alert-edit-error-notification")).toBeInTheDocument();
    });
  });

  async function setup() {
    const id = faker.string.uuid();
    const input = {
      name: faker.lorem.words(2),
      notificationChannelId: faker.string.uuid(),
      enabled: true,
      conditions: { operator: "lt" as const, field: "balance" as const, value: 5_000_000 }
    };
    const mockFetch = vi.fn(() => Promise.resolve(jsonResponse(buildWalletBalanceAlert({ id }))));
    const services = {
      queryClient: () => queryClient,
      api: () => createProxy(createApiSdk({ baseUrl: "", fetch: mockFetch }))
    };
    const childCapturer = createContainerTestingChildCapturer<ChildrenProps>();

    render(
      <CustomSnackbarProvider>
        <TestContainerProvider services={services}>
          <EditAlertContainer id={id} onEditSuccess={vi.fn()}>
            {childCapturer.renderChild}
          </EditAlertContainer>
        </TestContainerProvider>
      </CustomSnackbarProvider>
    );

    return { mockFetch, id, input, child: await childCapturer.awaitChild() };
  }
});
