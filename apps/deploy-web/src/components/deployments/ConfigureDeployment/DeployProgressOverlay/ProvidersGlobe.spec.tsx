import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiProviderList } from "@src/types/provider";
import type { DEPENDENCIES } from "./ProvidersGlobe";
import { ProvidersGlobe } from "./ProvidersGlobe";

import { render } from "@testing-library/react";
import { ComponentMock } from "@tests/unit/mocks";

type ProviderListResult = ReturnType<typeof DEPENDENCIES.useProviderList>;

describe(ProvidersGlobe.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders an online-provider marker for every online provider when none is focused", () => {
    const Globe = vi.fn(ComponentMock);
    setup({
      providers: [
        createProvider({ owner: "p1", name: "Provider One", ipLat: "10", ipLon: "20", isOnline: true }),
        createProvider({ owner: "p2", name: "Provider Two", ipLat: "30", ipLon: "40", isOnline: false })
      ],
      dependencies: { Globe }
    });

    expect(Globe.mock.calls[0][0].markers).toEqual([{ id: "p1", label: "Provider One", lat: 10, lng: 20 }]);
  });

  it("skips providers with non-finite coordinates", () => {
    const Globe = vi.fn(ComponentMock);
    setup({
      providers: [
        createProvider({ owner: "p1", name: "Bad", ipLat: "not-a-number", ipLon: "20", isOnline: true }),
        createProvider({ owner: "p2", name: "Good", ipLat: "5", ipLon: "6", isOnline: true })
      ],
      dependencies: { Globe }
    });

    expect(Globe.mock.calls[0][0].markers).toEqual([{ id: "p2", label: "Good", lat: 5, lng: 6 }]);
  });

  it("narrows to the focused provider and focuses the globe on it", () => {
    const Globe = vi.fn(ComponentMock);
    setup({
      focusedProviderAddress: "p2",
      providers: [
        createProvider({ owner: "p1", name: "Provider One", ipLat: "10", ipLon: "20", isOnline: true }),
        createProvider({ owner: "p2", name: "Provider Two", ipLat: "30", ipLon: "40", isOnline: true })
      ],
      dependencies: { Globe }
    });

    const props = Globe.mock.calls[0][0];
    expect(props.markers).toEqual([{ id: "p2", label: "Provider Two", lat: 30, lng: 40 }]);
    expect(props.focusedMarker).toEqual({ lat: 30, lng: 40 });
  });

  it("renders no markers and no focus before providers have loaded", () => {
    const Globe = vi.fn(ComponentMock);
    setup({ providers: undefined, dependencies: { Globe } });

    const props = Globe.mock.calls[0][0];
    expect(props.markers).toEqual([]);
    expect(props.focusedMarker).toBeNull();
  });

  it("does not focus on a focused address that is absent from the provider list", () => {
    const Globe = vi.fn(ComponentMock);
    setup({
      focusedProviderAddress: "missing",
      providers: [createProvider({ owner: "p1", name: "Provider One", ipLat: "10", ipLon: "20", isOnline: true })],
      dependencies: { Globe }
    });

    expect(Globe.mock.calls[0][0].focusedMarker).toBeNull();
  });

  it("uses the provider hostUri as the marker label when the name is null", () => {
    const Globe = vi.fn(ComponentMock);
    setup({
      providers: [createProvider({ owner: "p1", name: null, hostUri: "https://provider.example", ipLat: "1", ipLon: "2", isOnline: true })],
      dependencies: { Globe }
    });

    expect(Globe.mock.calls[0][0].markers).toEqual([{ id: "p1", label: "https://provider.example", lat: 1, lng: 2 }]);
  });

  describe("cobe options", () => {
    it("brightens the map and holds the glow at the card level under the dark theme", () => {
      const Globe = vi.fn(ComponentMock);
      setup({ theme: "dark", dependencies: { Globe } });

      expect(Globe.mock.calls[0][0].cobeOptions).toMatchObject({ mapBrightness: 8, glowColor: [0.09, 0.09, 0.09] });
    });

    it("uses the light map brightness and glow under the light theme", () => {
      const Globe = vi.fn(ComponentMock);
      setup({ theme: "light", dependencies: { Globe } });

      expect(Globe.mock.calls[0][0].cobeOptions).toMatchObject({ mapBrightness: 1, glowColor: [1, 1, 1] });
    });

    it("treats any non-dark theme as light", () => {
      const Globe = vi.fn(ComponentMock);
      setup({ theme: "system", dependencies: { Globe } });

      expect(Globe.mock.calls[0][0].cobeOptions).toMatchObject({ mapBrightness: 1, glowColor: [1, 1, 1] });
    });
  });

  function createProvider(overrides: Partial<ApiProviderList>): ApiProviderList {
    return mock<ApiProviderList>({
      owner: "owner",
      name: "Provider",
      hostUri: "https://provider",
      ipLat: "0",
      ipLon: "0",
      isOnline: true,
      ...overrides
    });
  }

  function setup(input: {
    focusedProviderAddress?: string | null;
    providers?: ApiProviderList[];
    theme?: string;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const useProviderList: typeof DEPENDENCIES.useProviderList = () =>
      mock<ProviderListResult>({ data: "providers" in input ? input.providers : [] }) as ProviderListResult;
    const useTheme: typeof DEPENDENCIES.useTheme = () => input.theme ?? "light";

    return render(
      <ProvidersGlobe
        focusedProviderAddress={input.focusedProviderAddress}
        dependencies={{ useProviderList, useTheme, Globe: vi.fn(ComponentMock), ...input.dependencies }}
      />
    );
  }
});
