import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./SignedInHosts";
import { SignedInHosts } from "./SignedInHosts";

import { render, screen } from "@testing-library/react";

describe(SignedInHosts.name, () => {
  it("mounts the hosts on a page that was not rendered for a visitor, whoever is looking", () => {
    setup({ isRenderedForVisitor: false, userId: undefined });

    expect(screen.getByText("host")).toBeInTheDocument();
  });

  it("leaves the hosts out of a page rendered for a visitor", () => {
    setup({ isRenderedForVisitor: true, userId: undefined });

    expect(screen.queryByText("host")).not.toBeInTheDocument();
  });

  it("mounts the hosts on a visitor's page once a session shows up", () => {
    setup({ isRenderedForVisitor: true, userId: "auth0|ada" });

    expect(screen.getByText("host")).toBeInTheDocument();
  });

  function setup(input: { isRenderedForVisitor: boolean; userId: string | undefined }) {
    const useUser: typeof DEPENDENCIES.useUser = () =>
      mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.userId ? { userId: input.userId } : undefined, isLoading: false });

    render(
      <SignedInHosts isRenderedForVisitor={input.isRenderedForVisitor} dependencies={{ useUser }}>
        <p>host</p>
      </SignedInHosts>
    );
  }
});
