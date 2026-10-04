import type { ComponentProps } from "react";
import { createRef } from "react";
import type { Camera, Scene, WebGLRenderer } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GlobeProvider } from "./clusterProviders";
import type { ProvidersGlobeHandle } from "./ProvidersGlobe";
import { ProvidersGlobe } from "./ProvidersGlobe";

import { act, render, screen } from "@testing-library/react";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;

describe("ProvidersGlobe", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("tells the page it can't draw when WebGL is unavailable", () => {
    const { onUnavailable } = setup({
      createRenderer: () => {
        throw new Error("WebGL is not supported");
      }
    });

    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it("draws the scene frame after frame and drops the renderer when it goes away", async () => {
    const { renderer, unmount } = setup({});

    await vi.waitFor(() => expect(renderer.render.mock.calls.length).toBeGreaterThan(1));
    unmount();

    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });

  it("skips the intro when it shouldn't play", () => {
    const { onIntroDone } = setup({ playIntro: false });

    expect(onIntroDone).toHaveBeenCalledTimes(1);
  });

  it("reports the intro done once it has played, and again after a replay", async () => {
    const { onIntroDone, rerender, skipAhead } = setup({ playIntro: true });
    expect(onIntroDone).not.toHaveBeenCalled();

    skipAhead(3500);
    await vi.waitFor(() => expect(onIntroDone).toHaveBeenCalledTimes(1));

    rerender({ introKey: 1 });
    skipAhead(3500);
    await vi.waitFor(() => expect(onIntroDone).toHaveBeenCalledTimes(2));
  });

  it("reports the zoom level as the view zooms in, focuses and resets", async () => {
    const { controls, onZoomChange } = setup({});

    act(() => controls.current?.zoomBy(-0.42));
    await vi.waitFor(() => expect(onZoomChange).toHaveBeenLastCalledWith(0.25));

    act(() => controls.current?.focus(10, 20, 2.35));
    await vi.waitFor(() => expect(onZoomChange).toHaveBeenLastCalledWith(8 / 12));

    act(() => controls.current?.resetView());
    await vi.waitFor(() => expect(onZoomChange).toHaveBeenLastCalledWith(0));
  });

  it("zooms with the wheel only once the pointer has settled over the globe", async () => {
    const { canvas, onZoomChange } = setup({});

    canvas.dispatchEvent(new MouseEvent("pointerenter"));
    const hastyWheel = new WheelEvent("wheel", { deltaY: -200, cancelable: true });
    canvas.dispatchEvent(hastyWheel);
    expect(hastyWheel.defaultPrevented).toBe(false);

    await new Promise(resolve => setTimeout(resolve, 450));
    const settledWheel = new WheelEvent("wheel", { deltaY: -200, cancelable: true });
    canvas.dispatchEvent(settledWheel);

    expect(settledWheel.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(onZoomChange).toHaveBeenLastCalledWith(2 / 12));
  });

  it("zooms in on a double click", async () => {
    const { canvas, onZoomChange } = setup({});

    canvas.dispatchEvent(new MouseEvent("dblclick", { clientX: 10, clientY: 10 }));

    await vi.waitFor(() => expect(onZoomChange).toHaveBeenLastCalledWith(0.25));
  });

  it("describes and picks the pin under the pointer once the selected provider faces the camera", async () => {
    const { canvas, onHover, onPick } = setup({ providers: [createProvider({ id: "akash1center", lat: 0, lng: 0 })], selectedId: "akash1center" });

    await vi.waitFor(
      () => {
        pointAt(canvas, "pointermove", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        expect(onHover).toHaveBeenLastCalledWith(expect.objectContaining({ providerIds: ["akash1center"] }));
      },
      { timeout: 4000 }
    );
    pointAt(canvas, "pointerdown", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    pointAt(canvas, "pointerup", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    canvas.dispatchEvent(new MouseEvent("pointerleave"));

    expect(onPick).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ providerIds: ["akash1center"] }));
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it("turns the globe instead of picking a pin when the pointer drags", async () => {
    const { canvas, onPick, onHover } = setup({ providers: [createProvider({ id: "akash1center", lat: 0, lng: 0 })], selectedId: "akash1center" });

    pointAt(canvas, "pointerdown", 100, 100);
    pointAt(canvas, "pointermove", 300, 160);
    pointAt(canvas, "pointerup", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    canvas.dispatchEvent(new MouseEvent("pointercancel"));

    expect(onPick).not.toHaveBeenCalled();
    expect(onHover).not.toHaveBeenCalled();
  });

  it("picks nothing on an empty patch of sky", () => {
    const { canvas, onPick } = setup({ providers: [createProvider({ id: "akash1center", lat: 0, lng: 0 })] });

    pointAt(canvas, "pointerdown", 2, 2);
    pointAt(canvas, "pointerup", 2, 2);

    expect(onPick).not.toHaveBeenCalled();
  });

  it("counts the providers behind a shared pin", async () => {
    setup({
      providers: [createProvider({ id: "akash1first", lat: 0, lng: 0 }), createProvider({ id: "akash1second", lat: 0.01, lng: 0.01 })],
      selectedId: "akash1first",
      activeIds: new Set(["akash1first"])
    });

    expect(await screen.findByText("2", undefined, { timeout: 4000 })).toBeInTheDocument();
  });

  it("drapes the land over the globe once it loads, whatever the theme", async () => {
    const landCanvas = document.createElement("canvas");
    const loadLandCanvas = vi.fn(() => Promise.resolve(landCanvas));
    const { rerender } = setup({ loadLandCanvas, theme: "dark" });

    rerender({ theme: "light" });

    await vi.waitFor(() => expect(loadLandCanvas).toHaveBeenCalledTimes(1));
  });

  function createProvider(overrides: Partial<GlobeProvider> & { id: string }): GlobeProvider {
    return { lat: 0, lng: 0, location: "Null Island", gpuCount: 0, vcpuCount: 8, ...overrides };
  }

  function pointAt(canvas: HTMLCanvasElement, type: string, clientX: number, clientY: number) {
    canvas.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
  }

  function createRenderer() {
    return mock<WebGLRenderer>({
      capabilities: mock<WebGLRenderer["capabilities"]>({ getMaxAnisotropy: () => 1 }),
      render: vi.fn((scene: Scene, camera: Camera) => {
        scene.updateMatrixWorld();
        camera.updateMatrixWorld();
      })
    });
  }

  function setup(input: {
    providers?: GlobeProvider[];
    selectedId?: string | null;
    activeIds?: ReadonlySet<string> | null;
    playIntro?: boolean;
    theme?: "light" | "dark";
    createRenderer?: () => WebGLRenderer;
    loadLandCanvas?: () => Promise<HTMLCanvasElement>;
  }) {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue(
      Object.assign(mock<DOMRect>(), { left: 0, top: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT })
    );
    const realNow = performance.now.bind(performance);
    let skippedMs = 0;
    vi.spyOn(performance, "now").mockImplementation(() => realNow() + skippedMs);
    const renderer = createRenderer();
    const controls = createRef<ProvidersGlobeHandle>();
    const props: ComponentProps<typeof ProvidersGlobe> = {
      controlsRef: controls,
      providers: input.providers ?? [],
      activeIds: input.activeIds ?? null,
      selectedId: input.selectedId ?? null,
      theme: input.theme ?? "light",
      introKey: 0,
      playIntro: input.playIntro ?? false,
      dim: false,
      shiftX: 0,
      onPick: vi.fn(),
      onHover: vi.fn(),
      onIntroDone: vi.fn(),
      onZoomChange: vi.fn(),
      onUnavailable: vi.fn(),
      graphics: {
        createRenderer: input.createRenderer ?? (() => renderer),
        loadLandCanvas: input.loadLandCanvas ?? (() => new Promise<HTMLCanvasElement>(() => undefined))
      }
    };
    const view = render(<ProvidersGlobe {...props} />);
    const canvas = view.container.querySelector("canvas") as HTMLCanvasElement;

    return {
      ...props,
      renderer,
      controls,
      canvas,
      skipAhead: (milliseconds: number) => {
        skippedMs += milliseconds;
      },
      unmount: view.unmount,
      rerender: (change: Partial<typeof props>) => view.rerender(<ProvidersGlobe {...props} {...change} />)
    };
  }
});
