import type { FC } from "react";
import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { dehydrateVisitorQueries } from "@src/components/templates/visitorPages/dehydrateVisitorQueries";
import type { DEPENDENCIES } from "./AppQueryClientProvider";
import { AppQueryClientProvider } from "./AppQueryClientProvider";

import { render, screen } from "@testing-library/react";

describe(AppQueryClientProvider.name, () => {
  it("serves the app's query cache in the browser", () => {
    const { appQueryClient, seenQueryClients } = setup({ isServerRender: false });

    expect(seenQueryClients).toEqual([appQueryClient]);
  });

  it("gives a server render a query cache of its own and leaves the app's untouched", () => {
    const { appQueryClient, seenQueryClients } = setup({ isServerRender: true, dehydratedQuery: { queryKey: ["publisher"], data: "Acme Labs" } });

    expect(seenQueryClients).toHaveLength(1);
    expect(seenQueryClients[0]).not.toBe(appQueryClient);
    expect(seenQueryClients[0].getQueryData(["publisher"])).toBe("Acme Labs");
    expect(appQueryClient.getQueryData(["publisher"])).toBeUndefined();
  });

  it("keeps the same cache across renders", () => {
    const { seenQueryClients, rerender } = setup({ isServerRender: true });

    rerender();

    expect(new Set(seenQueryClients).size).toBe(1);
  });

  it("renders with the queries the server read, without asking for them again", () => {
    const { queryFn } = setup({ isServerRender: false, dehydratedQuery: { queryKey: ["publisher"], data: "Acme Labs" } });

    expect(screen.getByText("Acme Labs")).toBeInTheDocument();
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("renders its children when the page came with no queries", () => {
    setup({ isServerRender: false });

    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  function setup(input: { isServerRender: boolean; dehydratedQuery?: { queryKey: string[]; data: string } }) {
    const appQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
    const seenQueryClients: QueryClient[] = [];
    const queryFn = vi.fn(() => new Promise<string>(() => {}));
    const dependencies: typeof DEPENDENCIES = {
      useRootContainer: () => Object.assign(mock<ReturnType<typeof DEPENDENCIES.useRootContainer>>(), { queryClient: appQueryClient }),
      useIsServerRender: () => input.isServerRender
    };
    const Publisher: FC = () => {
      seenQueryClients.push(useQueryClient());
      const { data } = useQuery({ queryKey: ["publisher"], queryFn, staleTime: 60_000 });

      return <p>{data ?? "loading"}</p>;
    };
    const tree = (
      <AppQueryClientProvider dehydratedState={input.dehydratedQuery && dehydrateVisitorQueries([input.dehydratedQuery])} dependencies={dependencies}>
        <Publisher />
      </AppQueryClientProvider>
    );
    const { rerender } = render(tree);

    return { appQueryClient, seenQueryClients, queryFn, rerender: () => rerender(tree) };
  }
});
