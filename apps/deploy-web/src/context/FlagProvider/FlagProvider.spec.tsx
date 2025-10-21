import React from "react";

import { UserAwareFlagProvider } from "./FlagProvider";

import { render } from "@testing-library/react";
import { ComponentMock } from "@tests/unit/mocks";

describe(UserAwareFlagProvider.name, () => {
  it("passes userId from useUser to the custom FlagProvider", () => {
    const testUser = { id: "my-user-id" };
    const customFlagProvider = ({ config, children }: any) => (
      <div data-testid="flag-provider">
        {config.context.userId}
        {children}
      </div>
    );
    const customUseUser = () => ({
      user: testUser,
      isLoading: false
    });

    const { getByTestId } = render(
      <UserAwareFlagProvider components={{ FlagProvider: customFlagProvider, useUser: customUseUser, WaitForFeatureFlags: ComponentMock }}>
        <div data-testid="child" />
      </UserAwareFlagProvider>
    );

    expect(getByTestId("flag-provider").textContent).toContain("my-user-id");
    expect(getByTestId("child")).toBeInTheDocument();
  });
});
