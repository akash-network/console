import type { NextRouter } from "next/router";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { CONSOLE_AIR_REPO_URL, DEPENDENCIES, NotFoundPage } from "./NotFoundPage";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(NotFoundPage.name, () => {
  it.each(["/get-started/wallet", "/mint-burn", "/settings/authorizations"])("shows the Console Air hint on removed self-custody route %s", asPath => {
    setup({ asPath });

    expect(screen.getByText("Looking for self-custody crypto features?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open the Console Air repo/i })).toHaveAttribute("href", CONSOLE_AIR_REPO_URL);
  });

  it.each(["/mint-burn/", "/get-started/wallet?ref=email", "/settings/authorizations#section"])(
    "normalizes the path before matching, still showing the hint for %s",
    asPath => {
      setup({ asPath });

      expect(screen.getByText("Looking for self-custody crypto features?")).toBeInTheDocument();
    }
  );

  it("hides the hint on an unrelated unknown path", () => {
    setup({ asPath: "/some/unknown/page" });

    expect(screen.queryByText("Looking for self-custody crypto features?")).not.toBeInTheDocument();
  });

  function setup(input: { asPath: string }) {
    const useRouter: typeof DEPENDENCIES.useRouter = () => mock<NextRouter>({ asPath: input.asPath });
    const useUser: typeof DEPENDENCIES.useUser = () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: undefined });

    return render(<NotFoundPage dependencies={MockComponents(DEPENDENCIES, { useRouter, useUser })} />);
  }
});
