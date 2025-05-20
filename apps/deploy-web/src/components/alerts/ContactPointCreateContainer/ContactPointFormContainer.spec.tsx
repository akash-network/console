import "@testing-library/jest-dom";

import React from "react";
import { type components, createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { faker } from "@faker-js/faker";
import type { RequestFnResponse } from "@openapi-qraft/react/src/lib/requestFn";
import { QueryClientProvider } from "@tanstack/react-query";

import { ContactPointCreateContainer } from "@src/components/alerts/ContactPointCreateContainer/ContactPointCreateContainer";
import { ServicesProvider } from "@src/context/ServicesProvider";
import { queryClient } from "@src/queries";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

describe("ContactPointForm", () => {
  it("triggers a contact point creation with the correct values", async () => {
    const { requestFn, input, user } = setup();

    fireEvent.click(screen.getByText("Create"));

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
              type: "email",
              userId: user.id
            }
          }
        })
      );
      expect(screen.getByTestId("contact-point-create-success-notification")).toBeInTheDocument();
    });
  });

  it("triggers a contact point creation and shows error message on error", async () => {
    const { requestFn, input, user } = setup();

    fireEvent.click(screen.getByText("Create"));

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
              type: "email",
              userId: user.id
            }
          }
        })
      );
      expect(screen.getByTestId("contact-point-create-error-notification")).toBeInTheDocument();
    });
  });

  function setup() {
    const user = {
      id: faker.string.uuid()
    };
    const getProfile = jest.fn();
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
            userId: user.id
          }
        }) as Promise<RequestFnResponse<components["schemas"]["ContactPointOutput"]["data"], unknown>>
    );
    const services = {
      notificationsApi: createAPIClient({
        requestFn,
        baseUrl: "",
        queryClient
      })
    };

    render(
      <UserProvider user={user} fetcher={getProfile}>
        <ServicesProvider services={services}>
          <QueryClientProvider client={queryClient}>
            <CustomSnackbarProvider>
              <ContactPointCreateContainer onCreate={jest.fn()}>
                {({ create }) => <button onClick={() => create(input)}>Create</button>}
              </ContactPointCreateContainer>
            </CustomSnackbarProvider>
          </QueryClientProvider>
        </ServicesProvider>
      </UserProvider>
    );

    return { requestFn, input, user };
  }
});
