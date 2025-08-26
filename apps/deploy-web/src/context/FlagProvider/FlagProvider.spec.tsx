import React from "react";

import { UserAwareFlagProvider } from "./FlagProvider";

import { render } from "@testing-library/react";

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
      <UserAwareFlagProvider components={{ FlagProvider: customFlagProvider, useUser: customUseUser }}>
        <div data-testid="child" />
      </UserAwareFlagProvider>
    );

    expect(getByTestId("flag-provider").textContent).toContain("my-user-id");
    expect(getByTestId("child")).toBeInTheDocument();
  });
});
