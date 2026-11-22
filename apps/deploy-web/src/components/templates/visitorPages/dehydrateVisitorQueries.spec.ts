import { hydrate, QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { dehydrateVisitorQueries } from "./dehydrateVisitorQueries";

describe(dehydrateVisitorQueries.name, () => {
  it("carries each query's data to the browser as fresh", () => {
    const queryClient = hydrated([
      { queryKey: ["template", "tpl-1"], data: { data: { title: "Open WebUI" } } },
      { queryKey: ["publisher", "acme"], data: { data: { name: "Acme Labs" } } }
    ]);

    expect(queryClient.getQueryData(["template", "tpl-1"])).toEqual({ data: { title: "Open WebUI" } });
    expect(queryClient.getQueryData(["publisher", "acme"])).toEqual({ data: { name: "Acme Labs" } });
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: ["publisher", "acme"] })
        ?.isStaleByTime(60_000)
    ).toBe(false);
  });

  it("marks partial data stale, so the browser loads the rest at once", () => {
    const queryClient = hydrated([{ queryKey: ["publisher", "acme"], data: { data: { name: "Acme Labs" } }, isPartial: true }]);

    expect(queryClient.getQueryData(["publisher", "acme"])).toEqual({ data: { name: "Acme Labs" } });
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: ["publisher", "acme"] })
        ?.isStaleByTime(24 * 60 * 60_000)
    ).toBe(true);
  });

  it("answers a state Next can send as page props", () => {
    const state = dehydrateVisitorQueries([{ queryKey: ["template", "tpl-1"], data: { data: { title: "Open WebUI", summary: undefined } } }]);

    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(JSON.stringify(state)).not.toContain("undefined");
  });

  function hydrated(queries: Parameters<typeof dehydrateVisitorQueries>[0]) {
    const queryClient = new QueryClient();
    hydrate(queryClient, dehydrateVisitorQueries(queries));
    return queryClient;
  }
});
