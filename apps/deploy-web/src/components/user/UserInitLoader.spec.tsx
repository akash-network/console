import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./UserInitLoader";
import { UserInitLoader } from "./UserInitLoader";

import { render, screen } from "@testing-library/react";

describe(UserInitLoader.name, () => {
  it("holds the page behind the boot overlay while the session loads", () => {
    setup({ isLoading: true });

    expect(screen.getByText("boot overlay")).toBeInTheDocument();
    expect(screen.queryByText("page")).not.toBeInTheDocument();
  });

  it("renders the page once the session has loaded", () => {
    setup({ isLoading: false });

    expect(screen.getByText("page")).toBeInTheDocument();
    expect(screen.queryByText("boot overlay")).not.toBeInTheDocument();
  });

  it("renders a page the server rendered for a visitor without waiting for the session", () => {
    setup({ isLoading: true, isRenderedForVisitor: true });

    expect(screen.getByText("page")).toBeInTheDocument();
    expect(screen.queryByText("boot overlay")).not.toBeInTheDocument();
  });

  function setup(input: { isLoading: boolean; isRenderedForVisitor?: boolean }) {
    const dependencies: typeof DEPENDENCIES = {
      useCustomUser: () => mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>({ user: undefined, isLoading: input.isLoading }),
      BootLoading: () => <p>boot overlay</p>
    };

    render(
      <UserInitLoader isRenderedForVisitor={input.isRenderedForVisitor} dependencies={dependencies}>
        <p>page</p>
      </UserInitLoader>
    );
  }
});
