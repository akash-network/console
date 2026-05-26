import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiProviderList } from "@src/types/provider";
import { DEPENDENCIES, PhasedDeploymentContainer } from "./PhasedDeploymentContainer";

import { fireEvent, render, screen } from "@testing-library/react";
import { ComponentMock } from "@tests/unit/mocks";

type FlowResult = ReturnType<typeof DEPENDENCIES.usePhasedDeploymentFlow>;
type ProviderListResult = ReturnType<typeof DEPENDENCIES.useProviderList>;

describe(PhasedDeploymentContainer.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes flow state through to PhasedDeploymentProgress", () => {
    const PhasedDeploymentProgress = vi.fn(ComponentMock);
    setup({
      templateName: "my-app",
      flow: { state: { kind: "matching" }, progressPercent: 42 },
      dependencies: { PhasedDeploymentProgress }
    });

    expect(PhasedDeploymentProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        state: { kind: "matching" },
        templateName: "my-app",
        progressPercent: 42
      }),
      expect.anything()
    );
  });

  it("invokes startOver and onCancel when PhasedDeploymentProgress requests a start over", () => {
    const startOver = vi.fn();
    const onCancel = vi.fn();
    const PhasedDeploymentProgress = vi.fn(ComponentMock);
    setup({
      flow: { startOver },
      onCancel,
      dependencies: { PhasedDeploymentProgress }
    });

    const onStartOver = PhasedDeploymentProgress.mock.calls[0][0].onStartOver as () => void;
    onStartOver();

    expect(startOver).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("opens the Akash Discord when PhasedDeploymentProgress requests support", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const PhasedDeploymentProgress = vi.fn(ComponentMock);
    setup({ dependencies: { PhasedDeploymentProgress } });

    const onContactSupport = PhasedDeploymentProgress.mock.calls[0][0].onContactSupport as () => void;
    onContactSupport();

    expect(open).toHaveBeenCalledWith("https://akash.network/discord", "_blank", "noopener,noreferrer");
  });

  it("forwards a successful deployment dseq to onSuccess", () => {
    const onSuccess = vi.fn();
    setup({
      onSuccess,
      usePhasedDeploymentFlow: options => {
        options.onSuccess("dseq-123");
        return buildFlow();
      }
    });

    expect(onSuccess).toHaveBeenCalledWith("dseq-123");
  });

  describe("globe markers", () => {
    it("renders an online-provider marker for every online provider when none is matched", () => {
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

    it("narrows to the matched provider and focuses the globe on it", () => {
      const Globe = vi.fn(ComponentMock);
      setup({
        flow: { matchedProviderAddress: "p2" },
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

    it("does not focus on a matched address that is absent from the provider list", () => {
      const Globe = vi.fn(ComponentMock);
      setup({
        flow: { matchedProviderAddress: "missing" },
        providers: [createProvider({ owner: "p1", name: "Provider One", ipLat: "10", ipLon: "20", isOnline: true })],
        dependencies: { Globe }
      });

      expect(Globe.mock.calls[0][0].focusedMarker).toBeNull();
    });
  });

  describe("globe cobe options", () => {
    it("brightens the map and darkens the glow under the dark theme", () => {
      const Globe = vi.fn(ComponentMock);
      setup({ theme: "dark", dependencies: { Globe } });

      expect(Globe.mock.calls[0][0].cobeOptions).toMatchObject({
        mapBrightness: 3,
        glowColor: [0.05, 0.05, 0.05]
      });
    });

    it("uses the light map brightness and glow under the light theme", () => {
      const Globe = vi.fn(ComponentMock);
      setup({ theme: "light", dependencies: { Globe } });

      expect(Globe.mock.calls[0][0].cobeOptions).toMatchObject({
        mapBrightness: 1,
        glowColor: [1, 1, 1]
      });
    });

    it("treats any non-dark theme as light", () => {
      const Globe = vi.fn(ComponentMock);
      setup({ theme: "system", dependencies: { Globe } });

      expect(Globe.mock.calls[0][0].cobeOptions).toMatchObject({
        mapBrightness: 1,
        glowColor: [1, 1, 1]
      });
    });
  });

  it("uses the provider hostUri as the marker label when the name is null", () => {
    const Globe = vi.fn(ComponentMock);
    setup({
      providers: [createProvider({ owner: "p1", name: null, hostUri: "https://provider.example", ipLat: "1", ipLon: "2", isOnline: true })],
      dependencies: { Globe }
    });

    expect(Globe.mock.calls[0][0].markers).toEqual([{ id: "p1", label: "https://provider.example", lat: 1, lng: 2 }]);
  });

  it("renders the Start over control wired to the real progress component", () => {
    const startOver = vi.fn();
    setup({ flow: { state: { kind: "error" }, startOver } });

    fireEvent.click(screen.getByRole("button", { name: "Start over" }));

    expect(startOver).toHaveBeenCalledTimes(1);
  });

  function buildFlow(overrides: Partial<FlowResult> = {}): FlowResult {
    return {
      state: { kind: "creating" },
      progressPercent: 0,
      phases: [
        { id: "creating", label: "Creating", status: "active" },
        { id: "matching", label: "Matching", status: "pending" },
        { id: "preparing", label: "Preparing", status: "pending" }
      ],
      matchedProviderAddress: null,
      retry: vi.fn(),
      startOver: vi.fn(),
      ...overrides
    };
  }

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

  function setup(
    input: {
      templateName?: string;
      sdl?: string;
      deposit?: number;
      onSuccess?: (dseq: string) => void;
      onCancel?: () => void;
      providers?: ApiProviderList[];
      theme?: string;
      flow?: Partial<FlowResult>;
      usePhasedDeploymentFlow?: typeof DEPENDENCIES.usePhasedDeploymentFlow;
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const useProviderList: typeof DEPENDENCIES.useProviderList = () =>
      mock<ProviderListResult>({ data: "providers" in input ? input.providers : [] }) as ProviderListResult;

    const useTheme: typeof DEPENDENCIES.useTheme = () => input.theme ?? "light";

    const usePhasedDeploymentFlow: typeof DEPENDENCIES.usePhasedDeploymentFlow = input.usePhasedDeploymentFlow ?? (() => buildFlow(input.flow));

    return render(
      <PhasedDeploymentContainer
        templateName={input.templateName ?? "test-template"}
        sdl={input.sdl ?? "sdl-content"}
        deposit={input.deposit}
        onSuccess={input.onSuccess}
        onCancel={input.onCancel}
        dependencies={{
          useProviderList,
          usePhasedDeploymentFlow,
          useTheme,
          PhasedDeploymentProgress: DEPENDENCIES.PhasedDeploymentProgress,
          Globe: vi.fn(ComponentMock),
          ...input.dependencies
        }}
      />
    );
  }
});
