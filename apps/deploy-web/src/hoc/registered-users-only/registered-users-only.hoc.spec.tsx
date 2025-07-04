import React from "react";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { faker } from "@faker-js/faker";

import { RegisteredUsersOnly } from "./registered-users-only.hoc";

import { render, screen, waitFor } from "@testing-library/react";

describe("RegisteredUsersOnly", () => {
  it("renders the wrapped component when user is registered", async () => {
    setup({ isRegistered: true });

    await waitFor(() => {
      expect(screen.getByTestId("test-component")).toBeInTheDocument();
      expect(screen.getByText("Test Component Content")).toBeInTheDocument();
      expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
    });
  });

  it("renders fallback component when user is not registered", () => {
    setup({ isRegistered: false });

    expect(screen.getByTestId("fallback")).toBeInTheDocument();
    expect(screen.getByText("Default Fallback Content")).toBeInTheDocument();
    expect(screen.queryByTestId("test-component")).not.toBeInTheDocument();
  });

  it("passes props to the wrapped component", async () => {
    setup({
      isRegistered: true,
      props: { testProp: "test-value" }
    });

    await waitFor(() => {
      expect(screen.getByTestId("test-component")).toBeInTheDocument();
      expect(screen.getByTestId("test-prop")).toBeInTheDocument();
      expect(screen.getByText("test-value")).toBeInTheDocument();
    });
  });

  it("sets the correct displayName", () => {
    const { TestComponent, FallbackComponent } = setup({ isRegistered: true });
    const WrappedComponent = RegisteredUsersOnly(TestComponent, FallbackComponent);
    expect(WrappedComponent.displayName).toBe("RegisteredUsersOnly(TestComponent)");
  });

  it("handles components without a displayName or name", () => {
    const { FallbackComponent } = setup({ isRegistered: true });
    const AnonymousComponent = () => <div>Anonymous</div>;
    Object.defineProperty(AnonymousComponent, "displayName", { value: undefined });
    Object.defineProperty(AnonymousComponent, "name", { value: undefined });

    const WrappedAnonymous = RegisteredUsersOnly(AnonymousComponent, FallbackComponent);

    expect(WrappedAnonymous.displayName).toBe("RegisteredUsersOnly(Component)");
  });

  function setup({ isRegistered = true, props = {} }: { isRegistered?: boolean; props?: Record<string, any>; fallbackComponent?: React.ComponentType }) {
    const FallbackComponent = () => <div data-testid="fallback">Default Fallback Content</div>;

    const TestComponent = (props: { testProp?: string }) => (
      <div data-testid="test-component">
        Test Component Content
        {props.testProp && <span data-testid="test-prop">{props.testProp}</span>}
      </div>
    );
    TestComponent.displayName = "TestComponent";

    const user = isRegistered
      ? {
          userId: faker.string.uuid(),
          email: faker.internet.email()
        }
      : {};
    const WrappedComponent = RegisteredUsersOnly(TestComponent, FallbackComponent);

    render(
      <UserProvider user={user}>
        <WrappedComponent {...props} />
      </UserProvider>
    );

    return {
      FallbackComponent,
      TestComponent
    };
  }
});
