import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./RedirectIfLeased";
import { RedirectIfLeased } from "./RedirectIfLeased";

import { render, screen } from "@testing-library/react";

describe(RedirectIfLeased.name, () => {
  it("renders the children immediately when there is no dseq to resume", () => {
    const { replace } = setup({ dseq: undefined });

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders the children once the resumed deployment resolves without leases", () => {
    const { replace } = setup({ dseq: "555", leases: [] });

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("holds the children behind a spinner while the deployment resolves", () => {
    setup({ dseq: "555", isLoading: true });

    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("redirects to the deployment detail page when the resumed deployment already has leases", () => {
    const { replace } = setup({ dseq: "555", leases: [{}] });

    expect(replace).toHaveBeenCalledWith(UrlService.deploymentDetails("555"));
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  function setup(input: { dseq?: string; leases?: unknown[]; isLoading?: boolean }) {
    const replace = vi.fn();
    const useGetDeployment = vi.fn(() =>
      mock<ReturnType<typeof DEPENDENCIES.useGetDeployment>>({
        data: input.leases ? ({ data: { leases: input.leases } } as never) : undefined,
        isLoading: input.isLoading ?? false
      })
    );
    const dependencies: typeof DEPENDENCIES = {
      Layout: vi.fn(({ children }: { children: ReactNode }) => <div data-testid="layout-mock">{children}</div>) as never,
      useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace })) as never,
      useGetDeployment: useGetDeployment as never
    };

    render(
      <RedirectIfLeased dseq={input.dseq} dependencies={dependencies}>
        <div data-testid="child" />
      </RedirectIfLeased>
    );

    return { replace };
  }
});
