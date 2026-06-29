import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiProviderList } from "@src/types/provider";
import type { DEPENDENCIES } from "./ProvidersGlobe";
import { ProvidersGlobe } from "./ProvidersGlobe";

import { render } from "@testing-library/react";

describe(ProvidersGlobe.name, () => {
  it("shows a marker for every online provider when none is focused", () => {
    const { globe } = setup({
      providers: [
        provider({ owner: "p1", name: "One", ipLat: "10", ipLon: "20", isOnline: true }),
        provider({ owner: "p2", name: "Two", ipLat: "30", ipLon: "40", isOnline: false })
      ]
    });
    expect(globe.mock.calls[0][0].markers).toEqual([{ id: "p1", label: "One", lat: 10, lng: 20 }]);
    expect(globe.mock.calls[0][0].focusedMarker).toBeNull();
  });

  it("narrows to the focused provider and focuses the camera on it", () => {
    const { globe } = setup({
      focusedProviderAddress: "p2",
      providers: [
        provider({ owner: "p1", name: "One", ipLat: "10", ipLon: "20", isOnline: true }),
        provider({ owner: "p2", name: "Two", ipLat: "30", ipLon: "40", isOnline: true })
      ]
    });
    expect(globe.mock.calls[0][0].markers).toEqual([{ id: "p2", label: "Two", lat: 30, lng: 40 }]);
    expect(globe.mock.calls[0][0].focusedMarker).toEqual({ lat: 30, lng: 40 });
  });

  function provider(overrides: Partial<ApiProviderList>) {
    return mock<ApiProviderList>(overrides);
  }

  function setup(input: { providers: ApiProviderList[]; focusedProviderAddress?: string }) {
    const globe = vi.fn<typeof DEPENDENCIES.Globe>(() => <div />);
    const dependencies: typeof DEPENDENCIES = {
      useProviderList: () => mock<ReturnType<typeof DEPENDENCIES.useProviderList>>({ data: input.providers }),
      useTheme: () => "light",
      Globe: globe
    };
    render(<ProvidersGlobe focusedProviderAddress={input.focusedProviderAddress} dependencies={dependencies} />);
    return { globe };
  }
});
