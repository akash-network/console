import "@testing-library/jest-dom";

import React from "react";
import { type components, createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { faker } from "@faker-js/faker";
import type { RequestFnResponse } from "@openapi-qraft/react/src/lib/requestFn";
import { QueryClientProvider } from "@tanstack/react-query";

import type { ChildrenProps } from "@src/components/alerts/ContactPointEditContainer/ContactPointEditContainer";
import { ContactPointEditContainer } from "@src/components/alerts/ContactPointEditContainer/ContactPointEditContainer";
import { ServicesProvider } from "@src/context/ServicesProvider";
import { queryClient } from "@src/queries";

import { render, screen, waitFor } from "@testing-library/react";
import { buildContactPoint } from "@tests/seeders/contactPoint";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";

describe("ContactPointEditContainer", () => {
  it("triggers contact point patch endpoint with the correct values", async () => {
    const { requestFn, input, child } = await setup();

    child.onEdit(input);

    await waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "patch",
          url: "/v1/contact-points/{id}"
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
      expect(screen.getByTestId("contact-point-edit-success-notification")).toBeInTheDocument();
    });
  });

  it("triggers contact point patch endpoint and shows error message on error", async () => {
    const { requestFn, input, child } = await setup();

    requestFn.mockRejectedValue(new Error());

    child.onEdit(input);

    await waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "patch",
          url: "/v1/contact-points/{id}"
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
      expect(screen.getByTestId("contact-point-edit-error-notification")).toBeInTheDocument();
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
          data: buildContactPoint(input)
        }) as Promise<RequestFnResponse<components["schemas"]["ContactPointOutput"]["data"], unknown>>
    );
    const services = {
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
        <ServicesProvider services={services}>
          <QueryClientProvider client={queryClient}>
            <ContactPointEditContainer id={input.id} onEditSuccess={jest.fn()}>
              {childCapturer.renderChild}
            </ContactPointEditContainer>
          </QueryClientProvider>
        </ServicesProvider>
      </CustomSnackbarProvider>
    );

    return { requestFn, input, child: await childCapturer.awaitChild() };
  }
});
