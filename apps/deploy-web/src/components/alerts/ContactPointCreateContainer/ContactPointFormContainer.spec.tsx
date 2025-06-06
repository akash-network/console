import "@testing-library/jest-dom";

import React from "react";
import { type components, createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { faker } from "@faker-js/faker";
import type { RequestFn, RequestFnResponse } from "@openapi-qraft/tanstack-query-react-types";
import { QueryClientProvider } from "@tanstack/react-query";

import type { ChildrenProps } from "@src/components/alerts/ContactPointCreateContainer/ContactPointCreateContainer";
import { ContactPointCreateContainer } from "@src/components/alerts/ContactPointCreateContainer/ContactPointCreateContainer";
import { ServicesProvider } from "@src/context/ServicesProvider";
import { queryClient } from "@src/queries";

import { render, screen, waitFor } from "@testing-library/react";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";

describe("ContactPointCreateContainer", () => {
  it("triggers a contact point creation with the correct values", async () => {
    const { requestFn, input, child } = await setup();

    child.create(input);

    await waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: "/v1/contact-points"
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
      expect(screen.getByTestId("contact-point-create-success-notification")).toBeInTheDocument();
    });
  });

  it("triggers a contact point creation and shows error message on error", async () => {
    const { requestFn, input, child } = await setup();

    child.create(input);

    requestFn.mockRejectedValue(new Error());

    await waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: "/v1/contact-points"
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
      expect(screen.getByTestId("contact-point-create-error-notification")).toBeInTheDocument();
    });
  });

  async function setup() {
    const input = {
      name: faker.lorem.word(),
      emails: [faker.internet.email()]
    };
    const requestFn = jest.fn(
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
        }) as Promise<RequestFnResponse<components["schemas"]["ContactPointOutput"]["data"], unknown>>
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
            <ContactPointCreateContainer onCreate={jest.fn()}>{childCapturer.renderChild}</ContactPointCreateContainer>
          </QueryClientProvider>
        </ServicesProvider>
      </CustomSnackbarProvider>
    );

    return { requestFn, input, child: await childCapturer.awaitChild() };
  }
});
