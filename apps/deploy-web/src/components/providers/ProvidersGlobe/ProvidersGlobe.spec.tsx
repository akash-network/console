import type { ComponentProps } from "react";
import { createRef } from "react";
import type {
  BufferGeometry,
  Camera,
  Group,
  Material,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
  Scene,
  SphereGeometry,
  Texture,
  TorusGeometry,
  WebGLRenderer
} from "three";
import { AdditiveBlending, BackSide, DoubleSide, Mesh, PerspectiveCamera, SRGBColorSpace } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GlobeProvider } from "./clusterProviders";
import type { ProvidersGlobeHandle } from "./ProvidersGlobe";
import { CAMERA_FAR, CAMERA_NEAR, FOCUSED_CAMERA_DISTANCE, ProvidersGlobe } from "./ProvidersGlobe";

import { act, render, screen } from "@testing-library/react";

const CANVAS_BOUNDS = { left: 100, top: 50, width: 800, height: 400 };
const CENTER = { x: 400, y: 200 };
const START_MS = 1000;
const FRAME_MS = 16;
const SETTLE_FRAMES = 300;
const ZOOM_TRACKING_MS = 140;
const INTRO_MS = 3000;
const RESTING_YAW = -0.7;
const RESTING_PITCH = 0.28;
const PIN_RADIUS = 0.021;
const PAIR_PIN_RADIUS = 0.03;
const CROWD_PIN_RADIUS = 0.037;

type BasicMesh<TGeometry extends BufferGeometry> = Mesh<TGeometry, MeshBasicMaterial>;

describe(ProvidersGlobe.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("when the renderer can't start", () => {
    it("tells the page it can't draw and ignores the view controls", () => {
      const { onUnavailable, onZoomChange, controls, tickZoomTracker } = setup({
        createRenderer: () => {
          throw new Error("WebGL is not supported");
        }
      });

      controls.current?.zoomBy(-1);
      controls.current?.resetView();
      controls.current?.focus(10, 20, FOCUSED_CAMERA_DISTANCE);
      tickZoomTracker();

      expect(onUnavailable).toHaveBeenCalledTimes(1);
      expect(onZoomChange).not.toHaveBeenCalled();
    });

    it("ignores a selection it has no globe to turn", () => {
      const { onUnavailable } = setup({
        providers: [createProvider({ id: "akash1selected", lat: 10, lng: 20 })],
        selectedId: "akash1selected",
        createRenderer: () => {
          throw new Error("WebGL is not supported");
        }
      });

      expect(onUnavailable).toHaveBeenCalledTimes(1);
    });
  });

  it("sizes the renderer to its box, falling back to 800 by 400 before layout", () => {
    const { renderer, advanceFrames, globe, wrap } = setup({ className: "h-80" });

    advanceFrames(1);

    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1);
    expect(renderer.setSize).toHaveBeenCalledWith(800, 400, false);
    expect(globe().camera.aspect).toBe(2);
    expect(wrap).toHaveClass("relative", "overflow-hidden", "h-80");
  });

  it("caps the pixel ratio and sizes the renderer to a laid out box", () => {
    const { renderer, advanceFrames, globe } = setup({ boxSize: { width: 1000, height: 250 }, devicePixelRatio: 3 });

    advanceFrames(1);

    expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
    expect(renderer.setSize).toHaveBeenCalledWith(1000, 250, false);
    expect(globe().camera.aspect).toBe(4);
  });

  it("follows its box when it resizes and ignores a collapsed box", () => {
    const { renderer, advanceFrames, globe, resize } = setup({});

    resize(1200, 300);
    resize(0, 300);
    advanceFrames(1);

    expect(renderer.setSize).toHaveBeenCalledTimes(2);
    expect(renderer.setSize).toHaveBeenLastCalledWith(1200, 300, false);
    expect(globe().camera.aspect).toBe(4);
    expect(globe().camera.projectionMatrix.elements).toEqual(new PerspectiveCamera(42, 4, 0.1, 100).projectionMatrix.elements);
  });

  it("stops drawing while scrolled out of view and resumes once back", () => {
    const { renderer, advanceFrames, setVisible } = setup({});
    advanceFrames(1);

    setVisible(false);
    advanceFrames(3);
    expect(renderer.render).toHaveBeenCalledTimes(1);

    setVisible(true);
    advanceFrames(1);
    expect(renderer.render).toHaveBeenCalledTimes(2);
  });

  it("releases the renderer, every geometry, material and texture, and the frame loop once it unmounts", async () => {
    const { renderer, advanceFrames, globe, deliverLand, resize, unmount } = setup({ providers: [createProvider({ id: "akash1center" })] });
    await deliverLand(document.createElement("canvas"));
    advanceFrames(1);
    const { scene, orb, land } = globe();
    const objects: Object3D[] = [];
    scene.traverse(object => {
      objects.push(object);
    });
    const meshes = objects.filter((object): object is Mesh => object instanceof Mesh);
    const resources = new Set<BufferGeometry | Material | Texture>([
      ...meshes.map(mesh => mesh.geometry),
      ...meshes.map(mesh => mesh.material as Material),
      orb.material.map as Texture,
      land.material.map as Texture
    ]);
    const disposals = [...resources].map(resource => vi.spyOn(resource, "dispose"));

    unmount();
    advanceFrames(2);
    resize(1200, 300);

    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(disposals.filter(dispose => dispose.mock.calls.length === 0)).toEqual([]);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(renderer.setSize).toHaveBeenCalledTimes(1);
  });

  it("stops reacting to the pointer once it unmounts", () => {
    const { canvas, controls, advanceFrames, advanceClock, pointAt, wheel, onHover, onPick, unmount } = setup({
      providers: [createProvider({ id: "akash1center" })]
    });
    const setPointerCapture = vi.fn();
    canvas.setPointerCapture = setPointerCapture;
    controls.current?.focus(0, 0);
    advanceFrames(SETTLE_FRAMES);
    pointAt("pointermove", CENTER.x, CENTER.y);
    pointAt("pointerenter", CENTER.x, CENTER.y);
    advanceClock(500);

    unmount();
    pointAt("pointerdown", CENTER.x, CENTER.y);
    pointAt("pointerup", CENTER.x, CENTER.y);
    pointAt("pointermove", 2, 2);
    pointAt("pointerleave", 2, 2);

    expect(wheel(-200).defaultPrevented).toBe(false);
    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
    expect(onHover).toHaveBeenCalledTimes(1);
  });

  it("ignores land that arrives after it unmounts", async () => {
    const { advanceFrames, globe, deliverLand, unmount } = setup({});
    advanceFrames(1);
    const { land } = globe();

    unmount();
    await deliverLand(document.createElement("canvas"));

    expect(land.material.map).toBeNull();
  });

  it("builds a dark orb with a rim, a land shell, an intro sweep and a pool of hidden pulse rings", () => {
    const { advanceFrames, globe } = setup({ providers: [createProvider({ id: "akash1center" })] });

    advanceFrames(1);
    const { camera, rotator, pivot, orb, rim, land, sweep, rings, pins } = globe();

    expect(camera).toMatchObject({ fov: 42, near: 0.1, far: 100 });
    expect(camera.position.z).toBe(CAMERA_FAR);
    expect(rotator.rotation.y).toBe(RESTING_YAW);
    expect(pivot.rotation.x).toBe(RESTING_PITCH);
    expect(orb.geometry.parameters.radius).toBe(0.985);
    expect(orb.material).toMatchObject({ transparent: true, opacity: closeTo(1) });
    expect(orb.material.map?.image).toBeInstanceOf(HTMLCanvasElement);
    expect(orb.material.map?.image).toMatchObject({ width: 1024, height: 512 });
    expect(orb.material.map?.colorSpace).toBe(SRGBColorSpace);
    expect(rim.geometry.parameters.radius).toBe(1.09);
    expect(rim.material).toMatchObject({ transparent: true, opacity: 0.16, side: BackSide, blending: AdditiveBlending, depthWrite: false });
    expect(land.geometry.parameters.radius).toBe(0.997);
    expect(land.material).toMatchObject({ transparent: true, opacity: 0, depthWrite: false, map: null });
    expect(land.material.color.getHex()).toBe(0x16161f);
    expect(sweep.geometry.parameters).toMatchObject({ radius: 1.012, tube: 0.0035 });
    expect(sweep.material).toMatchObject({ transparent: true, opacity: 0 });
    expect(sweep.material.color.getHex()).toBe(0xc98ae8);
    expect(rings).toHaveLength(10);
    expect(
      rings.map(ring => ({ visible: ring.visible, opacity: ring.material.opacity, transparent: ring.material.transparent, side: ring.material.side }))
    ).toEqual(Array.from({ length: 10 }, () => ({ visible: false, opacity: 0, transparent: true, side: DoubleSide })));
    expect(rings.map(ring => ring.material.color.getHex())).toEqual(Array.from({ length: 10 }, () => 0xc98ae8));
    expect(pins).toHaveLength(1);
    expect(pins[0].pin.material.transparent).toBe(true);
    expect(pins[0].halo.material.transparent).toBe(true);
    expect(pins[0].halo.material.color.getHex()).toBe(0xc98ae8);
  });

  it("paints the orb once and reuses it for every globe", () => {
    const { advanceFrames, globe, remount } = setup({});
    advanceFrames(1);
    const firstOrb = globe().orb.material.map?.image;

    remount();
    advanceFrames(1);

    expect(globe().orb.material.map?.image).toBe(firstOrb);
  });

  it("tints the rim and pins for the dark theme", () => {
    const { advanceFrames, globe } = setup({ theme: "dark", ...withActiveAndIdlePins() });

    advanceFrames(1);
    const { rim, pins } = globe();

    expect(rim.material.color.getHex()).toBe(0x8b5cf6);
    expect(pins.map(({ pin }) => pin.material.color.getHex())).toEqual([0xd2a0f2, 0x63536f]);
  });

  it("tints the rim and pins for the light theme", () => {
    const { advanceFrames, globe } = setup({ theme: "light", ...withActiveAndIdlePins() });

    advanceFrames(1);
    const { rim, pins } = globe();

    expect(rim.material.color.getHex()).toBe(0x7c3aed);
    expect(pins.map(({ pin }) => pin.material.color.getHex())).toEqual([0xd9b6f7, 0x6b5c7d]);
  });

  it("retints the rim and pins when the theme changes", () => {
    const { advanceFrames, globe, rerender } = setup({ theme: "light", ...withActiveAndIdlePins() });
    advanceFrames(1);

    rerender({ theme: "dark" });
    advanceFrames(1);
    const { rim, pins } = globe();

    expect(rim.material.color.getHex()).toBe(0x8b5cf6);
    expect(pins.map(({ pin }) => pin.material.color.getHex())).toEqual([0xd2a0f2, 0x63536f]);
  });

  it("places each pin and its halo just above the provider's spot on the surface", () => {
    const { advanceFrames, globe } = setup({ providers: [createProvider({ id: "akash1north", lat: 30, lng: 60 })] });

    advanceFrames(1);
    const [{ pin, halo }] = globe().pins;

    expect(pin.position.x).toBeCloseTo(0.442539, 5);
    expect(pin.position.y).toBeCloseTo(0.511, 5);
    expect(pin.position.z).toBeCloseTo(-0.7665, 5);
    expect(halo.position.toArray()).toEqual(pin.position.toArray());
  });

  it("grows each pin to a resting size that rises with the providers it stands for", () => {
    const { advanceFrames, globe } = setup({
      providers: [
        createProvider({ id: "akash1a-solo", lat: 0, lng: 0 }),
        createProvider({ id: "akash1b-pair", lat: 40, lng: 60 }),
        createProvider({ id: "akash1c-pair", lat: 40, lng: 60.2 }),
        ...["d", "e", "f", "g", "h"].map(suffix => createProvider({ id: `akash1${suffix}-crowd`, lat: -40, lng: -60 }))
      ]
    });

    advanceFrames(1);
    expect(globe().pins[0].pin.scale.x).toBeCloseTo(PIN_RADIUS * 0.22, 8);

    advanceFrames(SETTLE_FRAMES);
    const pins = globe().pins.map(({ pin, halo }) => ({
      scale: pin.scale.x,
      opacity: pin.material.opacity,
      haloScale: halo.scale.x,
      haloOpacity: halo.material.opacity
    }));

    expect(pins).toEqual([
      { scale: closeTo(PIN_RADIUS), opacity: closeTo(1), haloScale: closeTo(PIN_RADIUS * 2.15), haloOpacity: closeTo(0.16) },
      { scale: closeTo(PAIR_PIN_RADIUS), opacity: closeTo(1), haloScale: closeTo(PAIR_PIN_RADIUS * 2.15), haloOpacity: closeTo(0.16) },
      { scale: closeTo(CROWD_PIN_RADIUS), opacity: closeTo(1), haloScale: closeTo(CROWD_PIN_RADIUS * 2.15), haloOpacity: closeTo(0.16) }
    ]);
  });

  it("enlarges the selected pin and brightens its halo", () => {
    const { advanceFrames, globe } = setup({
      providers: [createProvider({ id: "akash1a-selected", lat: 0, lng: 0 }), createProvider({ id: "akash1b-other", lat: 40, lng: 60 })],
      selectedId: "akash1a-selected"
    });

    advanceFrames(SETTLE_FRAMES);
    const [selected, other] = globe().pins;

    expect(selected.pin.scale.x).toBeCloseTo(PIN_RADIUS * 1.75, 6);
    expect(selected.halo.scale.x).toBeCloseTo(PIN_RADIUS * 1.75 * 3, 6);
    expect(selected.halo.material.opacity).toBeCloseTo(0.34, 6);
    expect(other.pin.scale.x).toBeCloseTo(PIN_RADIUS, 6);
    expect(other.halo.material.opacity).toBeCloseTo(0.16, 6);
  });

  it("shrinks and greys out the pins outside the filter, keeping a pin with any match lit", () => {
    const { advanceFrames, globe } = setup({
      providers: [
        createProvider({ id: "akash1a-match", lat: 0, lng: 0 }),
        createProvider({ id: "akash1b-miss", lat: 40, lng: 60 }),
        createProvider({ id: "akash1c-match", lat: -40, lng: -60 }),
        createProvider({ id: "akash1d-miss", lat: -40, lng: -60.2 })
      ],
      activeIds: new Set(["akash1a-match", "akash1c-match"])
    });

    advanceFrames(SETTLE_FRAMES);
    const pins = globe().pins.map(({ pin, halo }) => ({
      scale: pin.scale.x,
      color: pin.material.color.getHex(),
      opacity: pin.material.opacity,
      haloOpacity: halo.material.opacity
    }));

    expect(pins).toEqual([
      { scale: closeTo(PIN_RADIUS), color: 0xd9b6f7, opacity: closeTo(1), haloOpacity: closeTo(0.16) },
      { scale: closeTo(PIN_RADIUS * 0.62), color: 0x6b5c7d, opacity: closeTo(0.5), haloOpacity: closeTo(0.04) },
      { scale: closeTo(PAIR_PIN_RADIUS), color: 0xd9b6f7, opacity: closeTo(1), haloOpacity: closeTo(0.16) }
    ]);
  });

  it("fades the globe and its pins back while dimmed, and restores them after", async () => {
    const { advanceFrames, globe, deliverLand, rerender } = setup({ providers: [createProvider({ id: "akash1center" })], dim: true });
    await deliverLand(document.createElement("canvas"));

    advanceFrames(SETTLE_FRAMES);
    expect(readShading(globe())).toEqual({ orb: closeTo(0.94), rim: closeTo(0.088), land: closeTo(0.5), pin: closeTo(0.74), halo: closeTo(0.112) });

    rerender({ dim: false });
    advanceFrames(SETTLE_FRAMES);
    expect(readShading(globe())).toEqual({ orb: closeTo(1), rim: closeTo(0.16), land: closeTo(1), pin: closeTo(1), halo: closeTo(0.16) });
  });

  it("slides the globe sideways toward the requested shift", () => {
    const { advanceFrames, globe } = setup({ shiftX: 0.3 });

    advanceFrames(1);
    expect(globe().pivot.position.x).toBeCloseTo(0.03, 8);

    advanceFrames(1);
    expect(globe().pivot.position.x).toBeCloseTo(0.057, 8);
  });

  it("rebuilds the pins when the providers change and releases the old ones", () => {
    const providers = [createProvider({ id: "akash1a-first", lat: 0, lng: 0 })];
    const { advanceFrames, globe, rerender } = setup({ providers });
    advanceFrames(1);
    const [previous] = globe().pins;
    const disposals = [vi.spyOn(previous.pin.material, "dispose"), vi.spyOn(previous.halo.material, "dispose")];

    rerender({ providers: [...providers, createProvider({ id: "akash1b-second", lat: 40, lng: 60 })] });
    advanceFrames(1);
    const meshes = globe().pins.flatMap(({ pin, halo }) => [pin, halo]);

    expect(meshes).toHaveLength(4);
    expect(meshes).not.toContain(previous.pin);
    expect(meshes).not.toContain(previous.halo);
    expect(disposals.map(dispose => dispose.mock.calls.length)).toEqual([1, 1]);
  });

  it("splits a shared pin as the view zooms in close", () => {
    const { advanceFrames, globe, controls, tickZoomTracker, onZoomChange } = setup({
      providers: [createProvider({ id: "akash1a-west", lat: 0, lng: 0 }), createProvider({ id: "akash1b-east", lat: 0, lng: 5 })]
    });
    advanceFrames(1);
    expect(globe().pins).toHaveLength(1);

    act(() => controls.current?.zoomBy(-10));
    tickZoomTracker();
    advanceFrames(1);

    expect(onZoomChange).toHaveBeenLastCalledWith(1);
    expect(globe().pins).toHaveLength(2);
  });

  it("keeps the pins that survive a zoom step at their size instead of growing them again", () => {
    const { advanceFrames, globe, controls, tickZoomTracker, onZoomChange } = setup({
      playIntro: false,
      providers: [createProvider({ id: "akash1a-west", lat: 0, lng: 0 }), createProvider({ id: "akash1b-east", lat: 40, lng: 90 })]
    });
    advanceFrames(SETTLE_FRAMES);
    const settled = globe().pins.map(({ pin }) => pin);

    act(() => controls.current?.zoomBy(-0.42));
    tickZoomTracker();
    advanceFrames(1);
    const rebuilt = globe().pins.map(({ pin }) => pin);

    expect(onZoomChange).toHaveBeenLastCalledWith(0.25);
    expect(rebuilt[0]).not.toBe(settled[0]);
    rebuilt.forEach(pin => expect(pin.scale.x).toBeCloseTo(PIN_RADIUS, 4));
  });

  describe("count labels", () => {
    it("counts the providers behind a shared pin, right where the pin sits", () => {
      const { advanceFrames, controls, pointAt, onHover } = setup({ providers: pairOfProviders({ lat: 10, lng: 10 }) });
      controls.current?.focus(0, 0);
      advanceFrames(SETTLE_FRAMES);

      const label = screen.getByText("2");
      const position = screenPositionOf(label);
      pointAt("pointermove", position.x, position.y);
      advanceFrames(1);

      expect(onHover).toHaveBeenLastCalledWith(expect.objectContaining({ providerIds: ["akash1a-pair", "akash1b-pair"] }));
      expect(screen.getByText("2")).toBe(label);
      expect(label.style.opacity).toBe("1");
      expect(label.style.transform).toMatch(/^translate\(\d+\.\dpx, \d+\.\dpx\) translate\(-50%, -50%\)$/);
      expect(label.style).toMatchObject({
        position: "absolute",
        fontSize: "10.5px",
        fontWeight: "700",
        lineHeight: "1",
        pointerEvents: "none",
        willChange: "transform"
      });
      expect(label.style.left).toMatch(/^0(px)?$/);
      expect(label.style.top).toMatch(/^0(px)?$/);
      expect(label.style.fontFamily).toContain("--font-geist-mono");
      expect(label.style.color).toMatch(/^(#16161f|rgb\(22, 22, 31\))$/);
    });

    it("keeps a label translucent while its pin isn't hovered", () => {
      const { advanceFrames, controls } = setup({ providers: pairOfProviders({ lat: 10, lng: 10 }) });
      controls.current?.focus(0, 0);

      advanceFrames(SETTLE_FRAMES);

      expect(screen.getByText("2").style.opacity).toBe("0.92");
    });

    it("leaves single-provider pins and pins on the far side unlabelled", () => {
      const { advanceFrames, controls } = setup({
        providers: [
          createProvider({ id: "akash1a-solo", lat: -15, lng: -15 }),
          ...pairOfProviders({ lat: 10, lng: 10 }),
          createProvider({ id: "akash1c-far", lat: 0, lng: 175 }),
          createProvider({ id: "akash1d-far", lat: 0, lng: 175.4 }),
          createProvider({ id: "akash1e-far", lat: 0.4, lng: 175 })
        ]
      });
      controls.current?.focus(0, 0);

      advanceFrames(SETTLE_FRAMES);

      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.queryByText("1")).not.toBeInTheDocument();
      expect(screen.queryByText("3")).not.toBeInTheDocument();
    });

    it("drops a label once its pin turns away", () => {
      const { advanceFrames, controls } = setup({ providers: pairOfProviders({ lat: 10, lng: 10 }) });
      controls.current?.focus(0, 0);
      advanceFrames(SETTLE_FRAMES);
      expect(screen.getByText("2")).toBeInTheDocument();

      controls.current?.focus(0, 180);
      advanceFrames(SETTLE_FRAMES);

      expect(screen.queryByText("2")).not.toBeInTheDocument();
    });

    it("keeps the labels after the pins are rebuilt", () => {
      const providers = pairOfProviders({ lat: 10, lng: 10 });
      const { advanceFrames, controls, rerender } = setup({ providers });
      controls.current?.focus(0, 0);
      advanceFrames(SETTLE_FRAMES);

      rerender({ providers: [...providers] });
      advanceFrames(SETTLE_FRAMES);

      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("holds a label back until its pin pops in during the intro", () => {
      const { advanceFrames } = setup({ providers: pairOfProviders({ lat: 0, lng: 0 }), playIntro: true });

      advanceFrames(1, INTRO_MS * 0.45);
      expect(screen.queryByText("2")).not.toBeInTheDocument();

      advanceFrames(1, INTRO_MS * 0.095);
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  describe("intro", () => {
    it("reports the intro done right away when it shouldn't play", () => {
      const { onIntroDone } = setup({ playIntro: false });

      expect(onIntroDone).toHaveBeenCalledTimes(1);
    });

    it("rings every pin that pops in on the same frame", () => {
      const { advanceFrames, globe } = setup({
        providers: [createProvider({ id: "akash1equator", lat: 0, lng: 0 }), createProvider({ id: "akash1north", lat: 50, lng: 0 })],
        playIntro: true
      });

      advanceFrames(1);
      advanceFrames(1, INTRO_MS * 0.45 - FRAME_MS);
      advanceFrames(1, INTRO_MS * 0.095);
      const { pins, rings } = globe();

      expect(rings.filter(ring => ring.visible).map(ring => ring.position.toArray())).toEqual(pins.map(({ pin }) => pin.position.toArray()));
    });

    it("keeps each pin dark until the sweep reaches its longitude, then pops it in with a pulse ring", () => {
      const { advanceFrames, globe, onIntroDone } = setup({ providers: [createProvider({ id: "akash1center", lat: 0, lng: 0 })], playIntro: true });

      advanceFrames(1);
      advanceFrames(1, INTRO_MS * 0.45 - FRAME_MS);
      const dark = globe();
      expect(dark.pins[0].pin.scale.x).toBe(0.0001);
      expect(dark.pins[0].pin.material.opacity).toBe(0);
      expect(dark.pins[0].halo.material.opacity).toBe(0);
      expect(dark.rings.filter(ring => ring.visible)).toEqual([]);
      expect(onIntroDone).not.toHaveBeenCalled();

      advanceFrames(1, INTRO_MS * 0.095);
      const lit = globe();
      const [ring, ...idleRings] = lit.rings;
      expect(lit.pins[0].pin.scale.x).toBeCloseTo(0.008778, 8);
      expect(lit.pins[0].halo.scale.x).toBeCloseTo(0.0188727, 8);
      expect(lit.pins[0].pin.material.opacity).toBeCloseTo(0.7, 8);
      expect(lit.pins[0].halo.material.opacity).toBeCloseTo(0.08, 8);
      expect(ring.visible).toBe(true);
      expect(ring.position.toArray()).toEqual(lit.pins[0].pin.position.toArray());
      expect(ring.scale.x).toBeCloseTo(0.0225222, 6);
      expect(ring.material.opacity).toBeCloseTo(0.725, 8);
      expect(idleRings.map(idleRing => ({ visible: idleRing.visible, opacity: idleRing.material.opacity }))).toEqual(
        Array.from({ length: 9 }, () => ({ visible: false, opacity: 0 }))
      );

      advanceFrames(40, 50);
      const settled = globe();
      expect(onIntroDone).toHaveBeenCalledTimes(1);
      expect(settled.rings.filter(idleRing => idleRing.visible)).toEqual([]);
      expect(settled.pins[0].pin.scale.x).toBeCloseTo(PIN_RADIUS, 4);
    });

    it("sweeps a band of light across the globe and settles it lit", async () => {
      const { advanceFrames, globe, deliverLand } = setup({ playIntro: true });
      await deliverLand(document.createElement("canvas"));

      advanceFrames(1);
      expect(readIntroShading(globe())).toEqual({ orb: 0x33333d, rim: closeTo(0.0013653), sweep: closeTo(0.0151501), land: expect.any(Number) });

      advanceFrames(1, INTRO_MS * 0.5 - FRAME_MS);
      expect(readIntroShading(globe())).toEqual({ orb: expect.any(Number), rim: closeTo(0.128), sweep: closeTo(0.8457311), land: closeTo(0.5975) });
      expect(globe().sweep.rotation.y).toBeCloseTo(Math.PI / 2, 8);

      advanceFrames(1, INTRO_MS * 0.45);
      expect(globe().sweep.material.opacity).toBe(0);

      advanceFrames(1, INTRO_MS * 0.05);
      expect(readIntroShading(globe())).toEqual({ orb: 0xffffff, rim: closeTo(0.16), sweep: 0, land: closeTo(1) });
    });

    it("lights the globe at once when the intro is switched off midway", () => {
      const { advanceFrames, globe, rerender } = setup({ playIntro: true });
      advanceFrames(1);
      expect(globe().orb.material.color.getHex()).toBe(0x33333d);

      rerender({ playIntro: false });
      advanceFrames(1);

      expect(globe().orb.material.color.getHex()).toBe(0xffffff);
    });

    it("spins the globe slowly while the intro plays", () => {
      const { advanceFrames, globe } = setup({ playIntro: true });

      advanceFrames(1);
      expect(globe().rotator.rotation.y).toBe(RESTING_YAW);

      advanceFrames(10);
      expect(globe().rotator.rotation.y).toBeCloseTo(-0.6871114, 6);
    });

    it("holds the globe still when the selected provider has no pin", () => {
      const { advanceFrames, globe } = setup({
        playIntro: false,
        providers: [createProvider({ id: "akash1shown", lat: 10, lng: 20 })],
        selectedId: "akash1hidden"
      });

      advanceFrames(11);

      expect(globe().rotator.rotation.y).toBe(RESTING_YAW);
      expect(globe().pivot.rotation.x).toBe(RESTING_PITCH);
    });

    it("holds the globe still when the intro doesn't play", () => {
      const { advanceFrames, globe } = setup({ playIntro: false });

      advanceFrames(11);

      expect(globe().rotator.rotation.y).toBe(RESTING_YAW);
      expect(globe().pivot.rotation.x).toBe(RESTING_PITCH);
    });

    it("replays the intro from the start, hiding the pins and pulling the camera back out", () => {
      const { advanceFrames, globe, controls, rerender, onIntroDone } = setup({ providers: [createProvider({ id: "akash1center" })], playIntro: true });
      advanceFrames(70, 50);
      act(() => controls.current?.zoomBy(-1));
      advanceFrames(SETTLE_FRAMES);
      expect(onIntroDone).toHaveBeenCalledTimes(1);

      rerender({ introKey: 1 });
      advanceFrames(1);
      expect(globe().camera.position.z).toBe(CAMERA_FAR);
      expect(globe().pins[0].pin.scale.x).toBe(0.0001);

      advanceFrames(70, 50);
      expect(onIntroDone).toHaveBeenCalledTimes(2);
    });

    it("pulses the pins that arrive while the intro plays", () => {
      const { advanceFrames, globe, rerender } = setup({ playIntro: true });
      advanceFrames(1);

      rerender({ providers: [createProvider({ id: "akash1center", lat: 0, lng: 0 })] });
      advanceFrames(1, INTRO_MS * 0.55);

      expect(globe().rings.filter(ring => ring.visible)).toHaveLength(1);
    });

    it("spins again after a replay once a focus has finished turning", () => {
      const { advanceFrames, globe, controls, rerender } = setup({ playIntro: false });
      controls.current?.focus(0, 0);
      advanceFrames(SETTLE_FRAMES);
      const settledYaw = globe().rotator.rotation.y;

      rerender({ playIntro: true });
      advanceFrames(2);

      expect(globe().rotator.rotation.y).toBeCloseTo(settledYaw + ((Math.PI * 2) / 78) * 0.032, 8);
    });
  });

  describe("view controls", () => {
    it("eases the camera toward each zoom step, holds the globe still and reports each new zoom level once", () => {
      const { advanceFrames, globe, controls, tickZoomTracker, onZoomChange } = setup({});
      tickZoomTracker();
      expect(onZoomChange).not.toHaveBeenCalled();

      act(() => controls.current?.zoomBy(-0.42));
      advanceFrames(1);
      expect(globe().camera.position.z).toBeCloseTo(3.4996, 8);
      tickZoomTracker();
      tickZoomTracker();
      expect(onZoomChange).toHaveBeenCalledExactlyOnceWith(0.25);

      advanceFrames(SETTLE_FRAMES);
      expect(globe().camera.position.z).toBeCloseTo(3.13, 6);
      expect(globe().rotator.rotation.y).toBe(RESTING_YAW);

      act(() => controls.current?.zoomBy(-10));
      tickZoomTracker();
      advanceFrames(SETTLE_FRAMES);
      expect(onZoomChange).toHaveBeenLastCalledWith(1);
      expect(globe().camera.position.z).toBeCloseTo(CAMERA_NEAR, 6);

      act(() => controls.current?.zoomBy(10));
      tickZoomTracker();
      advanceFrames(SETTLE_FRAMES);
      expect(onZoomChange).toHaveBeenLastCalledWith(0);
      expect(globe().camera.position.z).toBeCloseTo(CAMERA_FAR, 6);
    });

    it("turns a focused spot to the camera and zooms to the requested distance", () => {
      const { advanceFrames, globe, controls, tickZoomTracker, onZoomChange, pointAt, onHover } = setup({
        providers: [createProvider({ id: "akash1focused", lat: 20, lng: 30 })]
      });
      advanceFrames(1);

      controls.current?.focus(20, 30, FOCUSED_CAMERA_DISTANCE);
      advanceFrames(1, 450);
      expect(globe().rotator.rotation.y).toBeCloseTo(-1.0102529, 6);
      expect(globe().pivot.rotation.x).toBeCloseTo(0.2862159, 6);

      advanceFrames(SETTLE_FRAMES);
      tickZoomTracker();
      pointAt("pointermove", CENTER.x, CENTER.y);

      expect(globe().rotator.rotation.y).toBeCloseTo(-2.0943951, 3);
      expect(globe().pivot.rotation.x).toBeCloseTo(0.3490659, 4);
      expect(globe().camera.position.z).toBeCloseTo(FOCUSED_CAMERA_DISTANCE, 6);
      expect(onZoomChange).toHaveBeenLastCalledWith(8 / 12);
      expect(onHover).toHaveBeenLastCalledWith(expect.objectContaining({ providerIds: ["akash1focused"] }));
    });

    it("keeps the camera distance when a focus doesn't ask for one", () => {
      const { advanceFrames, globe, controls } = setup({});

      controls.current?.focus(-10, -20);
      advanceFrames(SETTLE_FRAMES);

      expect(globe().camera.position.z).toBeCloseTo(CAMERA_FAR, 6);
      expect(globe().pivot.rotation.x).toBeCloseTo(-0.1745329, 4);
    });

    it("tilts no further than the polar limit", () => {
      const { advanceFrames, globe, controls } = setup({});

      controls.current?.focus(80, 0);
      advanceFrames(SETTLE_FRAMES);

      expect(globe().pivot.rotation.x).toBeCloseTo(0.8, 6);
    });

    it("turns the shorter way round to a spot after a long drag", () => {
      const { advanceFrames, globe, controls, pointAt } = setup({});
      pointAt("pointerdown", 100, 200);
      pointAt("pointermove", 700, 200);
      pointAt("pointerup", 700, 200);

      controls.current?.focus(0, 0);
      advanceFrames(SETTLE_FRAMES);

      expect(globe().rotator.rotation.y).toBeCloseTo((3 * Math.PI) / 2, 3);
    });

    it("resets to the resting tilt and distance, spinning again only while the intro plays", () => {
      const { advanceFrames, globe, controls } = setup({ playIntro: false });
      controls.current?.focus(40, 40, CAMERA_NEAR);
      advanceFrames(SETTLE_FRAMES);
      const turnedYaw = globe().rotator.rotation.y;

      controls.current?.resetView();
      advanceFrames(SETTLE_FRAMES);

      expect(globe().pivot.rotation.x).toBeCloseTo(RESTING_PITCH, 6);
      expect(globe().camera.position.z).toBeCloseTo(CAMERA_FAR, 6);
      expect(globe().rotator.rotation.y).toBe(turnedYaw);
    });

    it("turns the selected provider to the camera, also when the selection changes later", () => {
      const providers = [createProvider({ id: "akash1a-first", lat: 0, lng: 0 }), createProvider({ id: "akash1b-second", lat: 0, lng: 60 })];
      const { advanceFrames, globe, rerender } = setup({ providers, selectedId: "akash1a-first" });
      advanceFrames(SETTLE_FRAMES);
      expect(globe().rotator.rotation.y).toBeCloseTo(-Math.PI / 2, 3);

      rerender({ selectedId: "akash1b-second" });
      advanceFrames(SETTLE_FRAMES);

      expect(globe().rotator.rotation.y).toBeCloseTo(-2.6179939, 3);
    });

    it("keeps a turn the user dragged in while the providers refresh around the same selection", () => {
      const providers = [createProvider({ id: "akash1a-first", lat: 0, lng: 0 })];
      const { advanceFrames, globe, rerender, pointAt } = setup({ providers, selectedId: "akash1a-first" });
      advanceFrames(SETTLE_FRAMES);
      pointAt("pointerdown", 100, 100);
      pointAt("pointermove", 300, 100);
      pointAt("pointerup", 300, 100);
      advanceFrames(SETTLE_FRAMES);
      const draggedYaw = globe().rotator.rotation.y;

      rerender({ providers: [createProvider({ id: "akash1a-first", lat: 0, lng: 0, gpuCount: 4 })] });
      advanceFrames(SETTLE_FRAMES);

      expect(draggedYaw).not.toBeCloseTo(-Math.PI / 2, 3);
      expect(globe().rotator.rotation.y).toBeCloseTo(draggedYaw, 6);
    });
  });

  describe("pointer", () => {
    it("hovers and picks the pin under the pointer, swelling it while hovered", () => {
      const { advanceFrames, globe, controls, pointAt, canvas, onHover, onPick } = setup({ providers: [createProvider({ id: "akash1center" })] });
      controls.current?.focus(0, 0);
      advanceFrames(SETTLE_FRAMES);

      pointAt("pointermove", CENTER.x, CENTER.y);
      pointAt("pointermove", CENTER.x + 1, CENTER.y);
      advanceFrames(SETTLE_FRAMES);
      const [hovered] = globe().pins;
      expect(onHover).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ providerIds: ["akash1center"] }));
      expect(canvas.style.cursor).toBe("pointer");
      expect(hovered.pin.scale.x).toBeCloseTo(PIN_RADIUS * 1.4, 6);
      expect(hovered.halo.material.opacity).toBeCloseTo(0.26, 6);

      pointAt("pointerdown", CENTER.x, CENTER.y);
      pointAt("pointerup", CENTER.x, CENTER.y);
      expect(onPick).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ providerIds: ["akash1center"] }));

      pointAt("pointermove", 2, 2);
      advanceFrames(SETTLE_FRAMES);
      expect(onHover).toHaveBeenLastCalledWith(null);
      expect(canvas.style.cursor).toBe("grab");
      expect(globe().pins[0].pin.scale.x).toBeCloseTo(PIN_RADIUS, 6);
    });

    it("clears the hover when the pointer leaves the globe", () => {
      const { advanceFrames, controls, pointAt, onHover } = setup({ providers: [createProvider({ id: "akash1center" })] });
      controls.current?.focus(0, 0);
      advanceFrames(SETTLE_FRAMES);
      pointAt("pointermove", CENTER.x, CENTER.y);

      pointAt("pointerleave", CENTER.x, CENTER.y);

      expect(onHover).toHaveBeenLastCalledWith(null);
      expect(onHover).toHaveBeenCalledTimes(2);
    });

    it("ignores the pointer over empty sky", () => {
      const { advanceFrames, pointAt, onHover, onPick } = setup({ providers: [createProvider({ id: "akash1center" })] });
      advanceFrames(SETTLE_FRAMES);

      pointAt("pointermove", 2, 2);
      pointAt("pointerdown", 2, 2);
      pointAt("pointerup", 2, 2);
      pointAt("pointerleave", 2, 2);

      expect(onHover).not.toHaveBeenCalled();
      expect(onPick).not.toHaveBeenCalled();
    });

    it("turns the globe with a drag and stops the spin", () => {
      const { advanceFrames, globe, pointAt } = setup({ playIntro: true });

      pointAt("pointerdown", 100, 100);
      pointAt("pointermove", 300, 160);
      advanceFrames(2);

      expect(globe().rotator.rotation.y).toBeCloseTo(0.5, 8);
      expect(globe().pivot.rotation.x).toBeCloseTo(0.58, 8);
    });

    it("tilts no further than the drag limit", () => {
      const { advanceFrames, globe, pointAt } = setup({});

      pointAt("pointerdown", 100, 100);
      pointAt("pointermove", 100, 1100);
      advanceFrames(1);
      expect(globe().pivot.rotation.x).toBeCloseTo(0.95, 8);

      pointAt("pointermove", 100, -900);
      advanceFrames(1);
      expect(globe().pivot.rotation.x).toBeCloseTo(-0.95, 8);
    });

    it("treats a press that travels more than a few pixels as a drag, not a pick", () => {
      const { advanceFrames, controls, pointAt, onPick } = setup({ providers: [createProvider({ id: "akash1center" })] });
      controls.current?.focus(0, 0);
      advanceFrames(SETTLE_FRAMES);

      pointAt("pointerdown", CENTER.x, CENTER.y);
      pointAt("pointermove", CENTER.x + 4, CENTER.y + 4);
      pointAt("pointerup", CENTER.x, CENTER.y);

      expect(onPick).not.toHaveBeenCalled();
    });

    it("still picks the pin when the press wobbles a few pixels", () => {
      const { advanceFrames, controls, pointAt, onPick } = setup({ providers: [createProvider({ id: "akash1center" })] });
      controls.current?.focus(0, 0);
      advanceFrames(SETTLE_FRAMES);

      pointAt("pointerdown", CENTER.x, CENTER.y);
      pointAt("pointermove", CENTER.x + 3, CENTER.y + 2);
      pointAt("pointerup", CENTER.x, CENTER.y);

      expect(onPick).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ providerIds: ["akash1center"] }));
    });

    it("lets go of a drag the browser cancels", () => {
      const { advanceFrames, globe, pointAt } = setup({});

      pointAt("pointerdown", 100, 100);
      pointAt("pointercancel", 100, 100);
      pointAt("pointermove", 300, 160);
      advanceFrames(2);

      expect(globe().rotator.rotation.y).toBe(RESTING_YAW);
      expect(globe().pivot.rotation.x).toBe(RESTING_PITCH);
    });

    it("zooms with the wheel only once the pointer has settled over the globe", () => {
      const { advanceFrames, advanceClock, globe, pointAt, wheel, tickZoomTracker, onZoomChange } = setup({});

      pointAt("pointerenter", CENTER.x, CENTER.y);
      advanceClock(419);
      expect(wheel(-200).defaultPrevented).toBe(false);

      advanceClock(1);
      expect(wheel(-200).defaultPrevented).toBe(true);
      tickZoomTracker();
      advanceFrames(2);
      expect(onZoomChange).toHaveBeenLastCalledWith(2 / 12);
      expect(globe().rotator.rotation.y).toBe(RESTING_YAW);

      pointAt("pointerleave", CENTER.x, CENTER.y);
      expect(wheel(-200).defaultPrevented).toBe(false);
    });

    it("zooms in a step on a double click without spinning", () => {
      const { advanceFrames, globe, pointAt, tickZoomTracker, onZoomChange } = setup({});

      pointAt("dblclick", 2, 2);
      tickZoomTracker();
      advanceFrames(2);

      expect(onZoomChange).toHaveBeenLastCalledWith(0.25);
      expect(globe().rotator.rotation.y).toBe(RESTING_YAW);
    });

    it("turns a double clicked pin to the camera", () => {
      const { advanceFrames, pointAt, onHover } = setup({ providers: pairOfProviders({ lat: 10, lng: -30 }) });
      advanceFrames(SETTLE_FRAMES);

      const position = screenPositionOf(screen.getByText("2"));
      pointAt("dblclick", position.x, position.y);
      advanceFrames(SETTLE_FRAMES);
      pointAt("pointermove", CENTER.x, CENTER.y);

      expect(onHover).toHaveBeenLastCalledWith(expect.objectContaining({ providerIds: ["akash1a-pair", "akash1b-pair"] }));
    });
  });

  describe("land", () => {
    it("drapes the land texture over the globe once it loads and fades it in", async () => {
      const landCanvas = document.createElement("canvas");
      const { advanceFrames, globe, deliverLand, loadLandCanvas } = setup({});
      advanceFrames(1);
      expect(globe().land.material.opacity).toBe(0);

      await deliverLand(landCanvas);
      const { land } = globe();
      expect(loadLandCanvas).toHaveBeenCalledTimes(1);
      expect(land.material.map?.image).toBe(landCanvas);
      expect(land.material.map).toMatchObject({ colorSpace: SRGBColorSpace, anisotropy: 8 });
      expect(land.material.color.getHex()).toBe(0xffffff);
      expect(land.material.version).toBe(1);

      advanceFrames(1, 130);
      expect(globe().land.material.opacity).toBeCloseTo(0.5, 8);

      advanceFrames(1, 130);
      expect(globe().land.material.opacity).toBe(1);
    });

    it("loads the land once across theme changes", async () => {
      const { deliverLand, loadLandCanvas, rerender } = setup({ theme: "dark" });

      rerender({ theme: "light" });
      await deliverLand(document.createElement("canvas"));

      expect(loadLandCanvas).toHaveBeenCalledTimes(1);
    });
  });

  function closeTo(expected: number) {
    return expect.closeTo(expected, 6);
  }

  function createProvider(overrides: Partial<GlobeProvider> & { id: string }): GlobeProvider {
    return { lat: 0, lng: 0, location: "Null Island", gpuCount: 0, vcpuCount: 8, ...overrides };
  }

  function pairOfProviders(spot: { lat: number; lng: number }): GlobeProvider[] {
    return [createProvider({ id: "akash1a-pair", ...spot }), createProvider({ id: "akash1b-pair", lat: spot.lat, lng: spot.lng + 0.4 })];
  }

  function withActiveAndIdlePins() {
    return {
      providers: [createProvider({ id: "akash1a-match", lat: 0, lng: 0 }), createProvider({ id: "akash1b-miss", lat: 40, lng: 60 })],
      activeIds: new Set(["akash1a-match"])
    };
  }

  function screenPositionOf(label: HTMLElement) {
    const [, x, y] = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(label.style.transform) ?? [];
    return { x: Number(x), y: Number(y) };
  }

  function readShading(view: ReturnType<typeof readGlobe>) {
    return {
      orb: view.orb.material.opacity,
      rim: view.rim.material.opacity,
      land: view.land.material.opacity,
      pin: view.pins[0].pin.material.opacity,
      halo: view.pins[0].halo.material.opacity
    };
  }

  function readIntroShading(view: ReturnType<typeof readGlobe>) {
    return {
      orb: view.orb.material.color.getHex(),
      rim: view.rim.material.opacity,
      sweep: view.sweep.material.opacity,
      land: view.land.material.opacity
    };
  }

  function readGlobe(scene: Scene, camera: PerspectiveCamera) {
    const [pivot] = scene.children as Group[];
    const [rotator, orb, rim, sweep] = pivot.children as [Group, BasicMesh<SphereGeometry>, BasicMesh<SphereGeometry>, BasicMesh<TorusGeometry>];
    const [land, markerGroup, ...rings] = rotator.children as [BasicMesh<SphereGeometry>, Group, ...BasicMesh<RingGeometry>[]];
    const markerMeshes = markerGroup.children as BasicMesh<SphereGeometry>[];
    const pins = markerMeshes.filter((_, index) => index % 2 === 0).map((pin, index) => ({ pin, halo: markerMeshes[index * 2 + 1] }));

    return { scene, camera, pivot, rotator, orb, rim, sweep, land, rings, pins };
  }

  function createObserverDouble<TEntry>() {
    const observers: { notify: (entries: TEntry[]) => void; targets: Set<Element> }[] = [];

    class ObserverDouble {
      private readonly targets = new Set<Element>();

      constructor(notify: (entries: TEntry[]) => void) {
        observers.push({ notify, targets: this.targets });
      }

      observe(target: Element) {
        this.targets.add(target);
      }

      disconnect() {
        this.targets.clear();
      }
    }

    return {
      ObserverDouble,
      notify: (target: Element, entry: TEntry) => observers.filter(observer => observer.targets.has(target)).forEach(observer => observer.notify([entry]))
    };
  }

  function createRenderer() {
    return mock<WebGLRenderer>({
      capabilities: mock<WebGLRenderer["capabilities"]>({ getMaxAnisotropy: () => 8 }),
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
    dim?: boolean;
    shiftX?: number;
    className?: string;
    boxSize?: { width: number; height: number };
    devicePixelRatio?: number;
    createRenderer?: () => WebGLRenderer;
  }) {
    let clock = START_MS;
    let pendingFrame: { id: number; draw: FrameRequestCallback } | null = null;
    let lastFrameId = 0;
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.stubGlobal("requestAnimationFrame", (draw: FrameRequestCallback) => {
      lastFrameId += 1;
      pendingFrame = { id: lastFrameId, draw };
      return lastFrameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      pendingFrame = pendingFrame?.id === id ? null : pendingFrame;
    });
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const resizeObservers = createObserverDouble<ResizeObserverEntry>();
    const visibilityObservers = createObserverDouble<IntersectionObserverEntry>();
    vi.stubGlobal("ResizeObserver", resizeObservers.ObserverDouble);
    vi.stubGlobal("IntersectionObserver", visibilityObservers.ObserverDouble);
    vi.stubGlobal("devicePixelRatio", input.devicePixelRatio ?? 1);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue(Object.assign(mock<DOMRect>(), CANVAS_BOUNDS));
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(input.boxSize?.width ?? 0);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(input.boxSize?.height ?? 0);
    let resolveLand: (landCanvas: HTMLCanvasElement) => void = () => undefined;
    const land = new Promise<HTMLCanvasElement>(resolve => {
      resolveLand = resolve;
    });
    const loadLandCanvas = vi.fn(() => land);
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
      dim: input.dim ?? false,
      shiftX: input.shiftX ?? 0,
      className: input.className,
      onPick: vi.fn(),
      onHover: vi.fn(),
      onIntroDone: vi.fn(),
      onZoomChange: vi.fn(),
      onUnavailable: vi.fn(),
      graphics: { createRenderer: input.createRenderer ?? (() => renderer), loadLandCanvas }
    };
    const view = render(<ProvidersGlobe {...props} />);
    const canvas = view.container.querySelector("canvas") as HTMLCanvasElement;
    const wrap = view.container.firstChild as HTMLDivElement;
    let currentProps = props;

    const pointAt = (type: string, x: number, y: number) => {
      canvas.dispatchEvent(new MouseEvent(type, { clientX: CANVAS_BOUNDS.left + x, clientY: CANVAS_BOUNDS.top + y, bubbles: true }));
    };

    return {
      ...props,
      renderer,
      controls,
      canvas,
      wrap,
      loadLandCanvas,
      pointAt,
      globe: () => {
        const [scene, camera] = renderer.render.mock.lastCall as [Scene, PerspectiveCamera];
        return readGlobe(scene, camera);
      },
      advanceFrames: (count: number, milliseconds = FRAME_MS) => {
        Array.from({ length: count }).forEach(() => {
          clock += milliseconds;
          const frame = pendingFrame;
          pendingFrame = null;
          frame?.draw(clock);
        });
      },
      advanceClock: (milliseconds: number) => {
        clock += milliseconds;
      },
      tickZoomTracker: () => {
        act(() => {
          vi.advanceTimersByTime(ZOOM_TRACKING_MS);
        });
      },
      wheel: (deltaY: number) => {
        const event = new WheelEvent("wheel", { deltaY, cancelable: true });
        canvas.dispatchEvent(event);
        return event;
      },
      resize: (width: number, height: number) => {
        Object.defineProperties(wrap, { clientWidth: { value: width, configurable: true }, clientHeight: { value: height, configurable: true } });
        resizeObservers.notify(wrap, mock<ResizeObserverEntry>());
      },
      setVisible: (isIntersecting: boolean) => {
        visibilityObservers.notify(wrap, mock<IntersectionObserverEntry>({ isIntersecting }));
      },
      deliverLand: async (landCanvas: HTMLCanvasElement) => {
        resolveLand(landCanvas);
        await land;
      },
      unmount: view.unmount,
      remount: () => view.rerender(<ProvidersGlobe key="remounted" {...currentProps} />),
      rerender: (change: Partial<typeof props>) => {
        currentProps = { ...currentProps, ...change };
        view.rerender(<ProvidersGlobe {...currentProps} />);
      }
    };
  }
});
