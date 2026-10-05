"use client";
import type { Ref } from "react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@akashnetwork/ui/utils";
import type { Material } from "three";
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer
} from "three";

import type { GlobeCluster, GlobeProvider } from "./clusterProviders";
import { clusterProviders, clusterRadiusForZoom } from "./clusterProviders";
import { loadLandCanvas } from "./landTexture";

export type GlobeGraphics = {
  createRenderer: (canvas: HTMLCanvasElement) => WebGLRenderer;
  loadLandCanvas: () => Promise<HTMLCanvasElement>;
};

const DEFAULT_GRAPHICS: GlobeGraphics = {
  createRenderer: canvas => new WebGLRenderer({ canvas, alpha: true, antialias: true }),
  loadLandCanvas
};

export type ProvidersGlobeHandle = {
  zoomBy: (delta: number) => void;
  resetView: () => void;
  focus: (lat: number, lng: number, cameraDistance?: number) => void;
};

type Props = {
  controlsRef: Ref<ProvidersGlobeHandle>;
  providers: GlobeProvider[];
  activeIds: ReadonlySet<string> | null;
  selectedId: string | null;
  theme: "light" | "dark";
  introKey: number;
  playIntro: boolean;
  dim: boolean;
  shiftX: number;
  onPick: (cluster: GlobeCluster) => void;
  onHover: (cluster: GlobeCluster | null) => void;
  onIntroDone: () => void;
  onZoomChange: (zoomLevel: number) => void;
  onUnavailable: () => void;
  className?: string;
  graphics?: GlobeGraphics;
};

export const CAMERA_FAR = 3.55;
export const CAMERA_NEAR = 1.78;
export const FOCUSED_CAMERA_DISTANCE = 2.35;

const GLOBE_RADIUS = 1;
const MARKER_ALTITUDE = 1.022;
const SPIN_RADIANS_PER_SECOND = (Math.PI * 2) / 78;
const INTRO_DURATION_MS = 3000;
const PULSE_POOL_SIZE = 10;
const RESTING_PITCH = 0.28;
const ZOOM_STEPS = 12;
/** A fast scroll past the hero must not get captured as a zoom. */
const WHEEL_DWELL_MS = 420;
const DRAG_THRESHOLD_PX = 5;
const LIT_ORB = new Color(0xffffff);
const UNLIT_ORB = new Color(0x33333d);

type Palette = { pin: number; pinDim: number; ring: number; glow: number; rim: number };

/** The orb stays dark in both themes; only the rim and pins shift so it reads as a sphere on a light page. */
function paletteFor(theme: "light" | "dark"): Palette {
  return theme === "dark"
    ? { pin: 0xd2a0f2, pinDim: 0x63536f, ring: 0xc98ae8, glow: 0xc98ae8, rim: 0x8b5cf6 }
    : { pin: 0xd9b6f7, pinDim: 0x6b5c7d, ring: 0xc98ae8, glow: 0xc98ae8, rim: 0x7c3aed };
}

type Marker = {
  cluster: GlobeCluster;
  mesh: Mesh<SphereGeometry, MeshBasicMaterial>;
  halo: Mesh<SphereGeometry, MeshBasicMaterial>;
  scale: number;
  radius: number;
  ignitesAt: number;
  ignited: boolean;
};

type Pulse = { mesh: Mesh<RingGeometry, MeshBasicMaterial>; progress: number; isActive: boolean };

type GlobeScene = {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  pivot: Group;
  rotator: Group;
  sphereMaterial: MeshBasicMaterial;
  landMaterial: MeshBasicMaterial;
  sweep: Mesh<TorusGeometry, MeshBasicMaterial>;
  rimMaterial: MeshBasicMaterial;
  markerGroup: Group;
  markerGeometry: SphereGeometry;
  markers: Marker[];
  pulses: Pulse[];
  palette: Palette;
  yaw: number;
  pitch: number;
  targetPitch: number;
  cameraDistance: number;
  targetCameraDistance: number;
  targetYaw: number | null;
  yawEaseStartedAt: number;
  autoSpin: boolean;
  dimFactor: number;
  shift: number;
  intro: { startedAt: number } | null;
  hovered: GlobeCluster | null;
  lastFrameAt: number;
  pendingPulses: Marker[];
  landReadyAt: number;
  isVisible: boolean;
  width: number;
  height: number;
  labels: Map<string, HTMLSpanElement>;
};

export function ProvidersGlobe(props: Props) {
  const { controlsRef, providers, selectedId, theme, introKey, playIntro, className } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GlobeScene | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [zoomLevel, setZoomLevel] = useState(0);

  useEffect(function createGlobeScene() {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const graphics = propsRef.current.graphics ?? DEFAULT_GRAPHICS;
    const globe = buildScene(canvas, wrap, propsRef.current.theme, graphics.createRenderer);
    if (!globe) {
      propsRef.current.onUnavailable();
      return;
    }
    sceneRef.current = globe;

    let isDisposed = false;
    graphics.loadLandCanvas().then(landCanvas => {
      if (isDisposed) return;
      const texture = new CanvasTexture(landCanvas);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = globe.renderer.capabilities.getMaxAnisotropy();
      globe.landMaterial.map = texture;
      globe.landMaterial.color.set(0xffffff);
      globe.landMaterial.needsUpdate = true;
      globe.landReadyAt = performance.now();
    });

    const resizeObserver = new ResizeObserver(() => resizeScene(globe, wrap));
    resizeObserver.observe(wrap);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      globe.isVisible = entry.isIntersecting;
    });
    visibilityObserver.observe(wrap);
    const detachPointer = attachPointerControls(canvas, globe, propsRef);

    let frameId = requestAnimationFrame(function renderFrame(now) {
      drawFrame(globe, now, propsRef.current, labelLayerRef.current);
      frameId = requestAnimationFrame(renderFrame);
    });

    return function disposeGlobeScene() {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      detachPointer();
      disposeScene(globe);
      sceneRef.current = null;
    };
  }, []);

  useEffect(
    function applyThemePalette() {
      const globe = sceneRef.current;
      if (!globe) return;
      globe.palette = paletteFor(theme);
      globe.rimMaterial.color.set(globe.palette.rim);
    },
    [theme]
  );

  useEffect(
    function rebuildMarkers() {
      const globe = sceneRef.current;
      if (!globe) return;
      replaceMarkers(globe, clusterProviders(providers, clusterRadiusForZoom(zoomLevel)), labelLayerRef.current);
    },
    [providers, zoomLevel]
  );

  useEffect(function trackZoomLevel() {
    let lastLevel = 0;
    const intervalId = setInterval(() => {
      const globe = sceneRef.current;
      if (!globe) return;
      const level = Math.round(((CAMERA_FAR - globe.targetCameraDistance) / (CAMERA_FAR - CAMERA_NEAR)) * ZOOM_STEPS) / ZOOM_STEPS;
      if (level === lastLevel) return;
      lastLevel = level;
      setZoomLevel(level);
      propsRef.current.onZoomChange(level);
    }, 140);
    return function stopTrackingZoomLevel() {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(
    function replayIntro() {
      const globe = sceneRef.current;
      if (!globe) return;
      globe.markers.forEach(marker => {
        marker.ignited = !playIntro;
        marker.scale = playIntro ? 0 : marker.scale;
      });

      if (!playIntro) {
        globe.intro = null;
        globe.autoSpin = false;
        propsRef.current.onIntroDone();
        return;
      }

      globe.intro = { startedAt: performance.now() };
      globe.autoSpin = true;
      globe.cameraDistance = globe.targetCameraDistance = CAMERA_FAR;
    },
    [introKey, playIntro]
  );

  const selectedProvider = selectedId ? providers.find(provider => provider.id === selectedId) : undefined;
  const selectedLat = selectedProvider?.lat;
  const selectedLng = selectedProvider?.lng;

  useEffect(
    function turnSelectedProviderToCamera() {
      const globe = sceneRef.current;
      if (!globe || selectedLat === undefined || selectedLng === undefined) return;
      faceCoordinates(globe, selectedLat, selectedLng);
    },
    [selectedId, selectedLat, selectedLng]
  );

  useImperativeHandle(
    controlsRef,
    () => ({
      zoomBy: delta => {
        const globe = sceneRef.current;
        if (!globe) return;
        globe.targetCameraDistance = clampDistance(globe.targetCameraDistance + delta);
        globe.autoSpin = false;
      },
      resetView: () => {
        const globe = sceneRef.current;
        if (!globe) return;
        globe.targetCameraDistance = CAMERA_FAR;
        globe.targetPitch = RESTING_PITCH;
        globe.targetYaw = null;
        globe.autoSpin = propsRef.current.playIntro;
      },
      focus: (lat, lng, cameraDistance) => {
        const globe = sceneRef.current;
        if (!globe) return;
        faceCoordinates(globe, lat, lng);
        if (cameraDistance !== undefined) globe.targetCameraDistance = clampDistance(cameraDistance);
      }
    }),
    []
  );

  return (
    <div ref={wrapRef} className={cn("relative overflow-hidden", className)}>
      <canvas ref={canvasRef} className="block h-full w-full cursor-grab touch-pan-y" aria-hidden />
      <div ref={labelLayerRef} className="pointer-events-none absolute inset-0" aria-hidden />
    </div>
  );
}

function buildScene(
  canvas: HTMLCanvasElement,
  wrap: HTMLDivElement,
  theme: "light" | "dark",
  createRenderer: GlobeGraphics["createRenderer"]
): GlobeScene | null {
  let renderer: WebGLRenderer;
  try {
    renderer = createRenderer(canvas);
  } catch {
    return null;
  }

  const width = wrap.clientWidth || 800;
  const height = wrap.clientHeight || 400;
  const palette = paletteFor(theme);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);

  const scene = new Scene();
  const camera = new PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.z = CAMERA_FAR;
  const pivot = new Group();
  const rotator = new Group();
  scene.add(pivot);
  pivot.add(rotator);

  const orbTexture = new CanvasTexture(drawOrbCanvas());
  orbTexture.colorSpace = SRGBColorSpace;
  const sphereMaterial = new MeshBasicMaterial({ map: orbTexture, color: 0xffffff, transparent: true, opacity: 1 });
  pivot.add(new Mesh(new SphereGeometry(GLOBE_RADIUS * 0.985, 64, 64), sphereMaterial));

  const rimMaterial = new MeshBasicMaterial({
    color: new Color(palette.rim),
    transparent: true,
    opacity: 0.16,
    side: BackSide,
    blending: AdditiveBlending,
    depthWrite: false
  });
  pivot.add(new Mesh(new SphereGeometry(GLOBE_RADIUS * 1.09, 48, 48), rimMaterial));

  const landMaterial = new MeshBasicMaterial({ color: new Color(0x16161f), transparent: true, opacity: 0, depthWrite: false });
  rotator.add(new Mesh(new SphereGeometry(GLOBE_RADIUS * 0.997, 96, 64), landMaterial));

  const sweep = new Mesh(
    new TorusGeometry(GLOBE_RADIUS * 1.012, 0.0035, 6, 120),
    new MeshBasicMaterial({ color: new Color(palette.glow), transparent: true, opacity: 0 })
  );
  pivot.add(sweep);

  const markerGroup = new Group();
  rotator.add(markerGroup);

  const ringGeometry = new RingGeometry(0.85, 1, 28);
  const pulses: Pulse[] = Array.from({ length: PULSE_POOL_SIZE }, () => {
    const mesh = new Mesh(ringGeometry, new MeshBasicMaterial({ color: new Color(palette.ring), transparent: true, opacity: 0, side: DoubleSide }));
    mesh.visible = false;
    rotator.add(mesh);
    return { mesh, progress: 0, isActive: false };
  });

  return {
    scene,
    camera,
    renderer,
    pivot,
    rotator,
    sphereMaterial,
    landMaterial,
    sweep,
    rimMaterial,
    markerGroup,
    markerGeometry: new SphereGeometry(1, 14, 14),
    markers: [],
    pulses,
    palette,
    yaw: -0.7,
    pitch: RESTING_PITCH,
    targetPitch: RESTING_PITCH,
    cameraDistance: CAMERA_FAR,
    targetCameraDistance: CAMERA_FAR,
    targetYaw: null,
    yawEaseStartedAt: 0,
    autoSpin: true,
    dimFactor: 0,
    shift: 0,
    intro: null,
    hovered: null,
    lastFrameAt: 0,
    pendingPulses: [],
    landReadyAt: 0,
    isVisible: true,
    width,
    height,
    labels: new Map()
  };
}

let orbCanvas: HTMLCanvasElement | null = null;

function drawOrbCanvas(): HTMLCanvasElement {
  if (orbCanvas) return orbCanvas;
  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#111119";
    context.fillRect(0, 0, width, height);
    const highlightX = ((-124 + 180) / 360) * width;
    const highlightY = ((90 - 26) / 180) * height;
    const gradient = context.createRadialGradient(highlightX, highlightY, 0, highlightX, highlightY, width * 0.4);
    gradient.addColorStop(0, "#272738");
    gradient.addColorStop(1, "rgba(17,17,25,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
  orbCanvas = canvas;
  return canvas;
}

function resizeScene(globe: GlobeScene, wrap: HTMLDivElement) {
  globe.width = wrap.clientWidth;
  globe.height = wrap.clientHeight;
  if (!globe.width || !globe.height) return;
  globe.camera.aspect = globe.width / globe.height;
  globe.camera.updateProjectionMatrix();
  globe.renderer.setSize(globe.width, globe.height, false);
}

function attachPointerControls(canvas: HTMLCanvasElement, globe: GlobeScene, propsRef: { current: Props }): () => void {
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let drag: { x: number; y: number; yaw: number; pitch: number; moved: number } | null = null;
  let pointerEnteredAt = 0;

  const markerAt = (event: PointerEvent | MouseEvent): Marker | null => {
    if (!globe.markers.length) return null;
    const bounds = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, globe.camera);
    const [hit] = raycaster.intersectObjects(
      globe.markers.map(marker => marker.mesh),
      false
    );
    return hit ? globe.markers.find(marker => marker.mesh === hit.object) ?? null : null;
  };

  const startDrag = (event: PointerEvent) => {
    drag = { x: event.clientX, y: event.clientY, yaw: globe.yaw, pitch: globe.pitch, moved: 0 };
    canvas.setPointerCapture?.(event.pointerId);
  };

  const moveOrHover = (event: PointerEvent) => {
    if (drag) {
      const deltaX = event.clientX - drag.x;
      const deltaY = event.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.abs(deltaX) + Math.abs(deltaY));
      globe.yaw = drag.yaw + deltaX * 0.006;
      globe.pitch = globe.targetPitch = Math.max(-0.95, Math.min(0.95, drag.pitch + deltaY * 0.005));
      globe.autoSpin = false;
      globe.targetYaw = null;
      return;
    }

    const hovered = markerAt(event)?.cluster ?? null;
    if (hovered?.id === globe.hovered?.id) return;
    globe.hovered = hovered;
    canvas.style.cursor = hovered ? "pointer" : "grab";
    propsRef.current.onHover(hovered);
  };

  const endDragOrPick = (event: PointerEvent) => {
    const wasDrag = !!drag && drag.moved > DRAG_THRESHOLD_PX;
    drag = null;
    if (wasDrag) return;
    const picked = markerAt(event);
    if (picked) propsRef.current.onPick(picked.cluster);
  };

  const cancelDrag = () => {
    drag = null;
  };

  const leave = () => {
    drag = null;
    pointerEnteredAt = 0;
    if (!globe.hovered) return;
    globe.hovered = null;
    propsRef.current.onHover(null);
  };

  const enter = () => {
    pointerEnteredAt = performance.now();
  };

  const zoomWithWheel = (event: WheelEvent) => {
    if (!pointerEnteredAt || performance.now() - pointerEnteredAt < WHEEL_DWELL_MS) return;
    event.preventDefault();
    globe.targetCameraDistance = clampDistance(globe.targetCameraDistance + event.deltaY * 0.0016);
    globe.autoSpin = false;
  };

  const zoomInOnDoubleClick = (event: MouseEvent) => {
    const picked = markerAt(event);
    globe.targetCameraDistance = clampDistance(globe.targetCameraDistance - 0.45);
    if (picked) faceCoordinates(globe, picked.cluster.lat, picked.cluster.lng);
    globe.autoSpin = false;
  };

  canvas.addEventListener("pointerdown", startDrag);
  canvas.addEventListener("pointermove", moveOrHover);
  canvas.addEventListener("pointerup", endDragOrPick);
  canvas.addEventListener("pointercancel", cancelDrag);
  canvas.addEventListener("pointerenter", enter);
  canvas.addEventListener("pointerleave", leave);
  canvas.addEventListener("wheel", zoomWithWheel, { passive: false });
  canvas.addEventListener("dblclick", zoomInOnDoubleClick);

  return function detachPointerControls() {
    canvas.removeEventListener("pointerdown", startDrag);
    canvas.removeEventListener("pointermove", moveOrHover);
    canvas.removeEventListener("pointerup", endDragOrPick);
    canvas.removeEventListener("pointercancel", cancelDrag);
    canvas.removeEventListener("pointerenter", enter);
    canvas.removeEventListener("pointerleave", leave);
    canvas.removeEventListener("wheel", zoomWithWheel);
    canvas.removeEventListener("dblclick", zoomInOnDoubleClick);
  };
}

function drawFrame(globe: GlobeScene, now: number, props: Props, labelLayer: HTMLDivElement | null) {
  const elapsedSeconds = Math.min(0.05, (now - (globe.lastFrameAt || now)) / 1000);
  globe.lastFrameAt = now;

  const introProgress = advanceIntro(globe, now, props);
  rotateGlobe(globe, now, elapsedSeconds);

  globe.cameraDistance += (globe.targetCameraDistance - globe.cameraDistance) * 0.12;
  globe.camera.position.z = globe.cameraDistance;
  globe.shift += (props.shiftX - globe.shift) * 0.1;
  globe.pivot.position.x = globe.shift;
  globe.dimFactor += ((props.dim ? 1 : 0) - globe.dimFactor) * 0.07;

  shadeSurface(globe, now, introProgress);
  updateMarkers(globe, introProgress, props);
  updatePulses(globe, elapsedSeconds);

  if (!globe.isVisible) return;
  globe.renderer.render(globe.scene, globe.camera);
  if (labelLayer) placeClusterLabels(globe, labelLayer);
}

function advanceIntro(globe: GlobeScene, now: number, props: Props): number | null {
  if (!globe.intro) return null;
  const progress = Math.min(1, (now - globe.intro.startedAt) / INTRO_DURATION_MS);
  if (progress < 1) return progress;
  globe.intro = null;
  props.onIntroDone();
  return null;
}

function rotateGlobe(globe: GlobeScene, now: number, elapsedSeconds: number) {
  if (globe.autoSpin && globe.targetYaw === null) globe.yaw += SPIN_RADIANS_PER_SECOND * elapsedSeconds;
  if (globe.targetYaw !== null) {
    const progress = Math.min(1, (now - globe.yawEaseStartedAt) / 900);
    const eased = 1 - Math.pow(1 - progress, 3);
    globe.yaw += (globe.targetYaw - globe.yaw) * (eased * 0.22 + 0.03);
    if (progress >= 1) globe.targetYaw = null;
  }
  globe.pitch += (globe.targetPitch - globe.pitch) * 0.09;
  globe.rotator.rotation.y = globe.yaw;
  globe.pivot.rotation.x = globe.pitch;
}

function shadeSurface(globe: GlobeScene, now: number, introProgress: number | null) {
  const visibility = 1 - 0.5 * globe.dimFactor;
  /** The land shell stays invisible until its texture arrives, so it never flashes as a bare white ball. */
  const landFadeIn = globe.landReadyAt ? Math.min(1, (now - globe.landReadyAt) / 260) : 0;

  if (introProgress === null) {
    globe.landMaterial.opacity = visibility * landFadeIn;
    globe.sphereMaterial.color.copy(LIT_ORB);
    globe.sweep.material.opacity = 0;
    globe.rimMaterial.opacity = 0.16 * (1 - 0.45 * globe.dimFactor);
  } else {
    const lit = Math.min(1, Math.max(0, (introProgress - 0.05) / 0.8));
    globe.landMaterial.opacity = (0.08 + 0.92 * lit) * visibility * landFadeIn;
    globe.sphereMaterial.color.lerpColors(UNLIT_ORB, LIT_ORB, lit);
    globe.sweep.material.opacity = introProgress < 0.94 ? 0.85 * Math.sin(Math.PI * Math.min(1, introProgress / 0.94)) : 0;
    globe.sweep.rotation.y = -Math.PI / 2 + introProgress * Math.PI * 2;
    globe.rimMaterial.opacity = 0.16 * Math.min(1, introProgress * 1.6) * (1 - 0.45 * globe.dimFactor);
  }
  globe.sphereMaterial.opacity = 0.94 + 0.06 * (1 - globe.dimFactor);
}

function updateMarkers(globe: GlobeScene, introProgress: number | null, props: Props) {
  for (const marker of globe.markers) {
    const arrival = markerArrival(globe, marker, introProgress);
    const isSelected = !!props.selectedId && marker.cluster.providerIds.includes(props.selectedId);
    const isHovered = globe.hovered?.id === marker.cluster.id;
    const isActive = !props.activeIds || marker.cluster.providerIds.some(id => props.activeIds?.has(id));
    const bounce = arrival < 1 ? 1 + 0.9 * Math.sin(Math.PI * arrival) : 1;
    const targetScale = marker.radius * (isSelected ? 1.75 : isHovered ? 1.4 : 1) * bounce * (isActive ? 1 : 0.62);

    marker.scale += (targetScale * (arrival > 0 ? 1 : 0) - marker.scale) * 0.22;
    marker.mesh.scale.setScalar(Math.max(0.0001, marker.scale));
    marker.mesh.material.color.set(isActive ? globe.palette.pin : globe.palette.pinDim);
    marker.mesh.material.opacity = (isActive ? 1 : 0.5) * (0.74 + 0.26 * (1 - globe.dimFactor)) * Math.min(1, arrival * 1.4);
    marker.halo.scale.setScalar(Math.max(0.0001, marker.scale * (isSelected ? 3 : 2.15)));
    marker.halo.material.opacity = (isSelected ? 0.34 : isHovered ? 0.26 : 0.16) * (isActive ? 1 : 0.25) * (1 - 0.3 * globe.dimFactor) * Math.min(1, arrival);
  }
}

function markerArrival(globe: GlobeScene, marker: Marker, introProgress: number | null): number {
  if (introProgress === null) return 1;
  if (introProgress < marker.ignitesAt) return 0;
  if (!marker.ignited) {
    marker.ignited = true;
    globe.pendingPulses.push(marker);
  }
  return Math.min(1, (introProgress - marker.ignitesAt) / 0.09);
}

function updatePulses(globe: GlobeScene, elapsedSeconds: number) {
  for (const marker of globe.pendingPulses) {
    const free = globe.pulses.find(pulse => !pulse.isActive);
    if (!free) break;
    free.isActive = true;
    free.progress = 0;
    free.mesh.visible = true;
    free.mesh.position.copy(marker.mesh.position);
    free.mesh.lookAt(0, 0, 0);
  }
  globe.pendingPulses = [];

  for (const pulse of globe.pulses) {
    if (!pulse.isActive) continue;
    pulse.progress += elapsedSeconds / 1.5;
    if (pulse.progress >= 1) {
      pulse.isActive = false;
      pulse.mesh.visible = false;
      continue;
    }
    const eased = 1 - Math.pow(1 - pulse.progress, 2);
    pulse.mesh.scale.setScalar(0.014 + eased * 0.13);
    pulse.mesh.material.opacity = (1 - pulse.progress) * 0.75 * (1 - 0.4 * globe.dimFactor);
  }
}

/** Written straight to the DOM: these move every frame, and routing them through React state would re-render the hero sixty times a second. */
function placeClusterLabels(globe: GlobeScene, layer: HTMLDivElement) {
  const position = new Vector3();
  const placed = new Set<string>();

  for (const marker of globe.markers) {
    if (marker.cluster.providerIds.length < 2 || marker.scale < 0.008) continue;
    marker.mesh.getWorldPosition(position);
    if (position.z <= 0.06) continue;
    const projected = position.clone().project(globe.camera);
    const id = marker.cluster.id;
    placed.add(id);

    let label = globe.labels.get(id);
    if (!label) {
      label = createClusterLabel(marker.cluster.providerIds.length);
      layer.appendChild(label);
      globe.labels.set(id, label);
    }
    const x = ((projected.x * 0.5 + 0.5) * globe.width).toFixed(1);
    const y = ((-projected.y * 0.5 + 0.5) * globe.height).toFixed(1);
    label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    label.style.opacity = globe.hovered?.id === id ? "1" : "0.92";
  }

  globe.labels.forEach((label, id) => {
    if (placed.has(id)) return;
    label.remove();
    globe.labels.delete(id);
  });
}

function createClusterLabel(count: number): HTMLSpanElement {
  const label = document.createElement("span");
  label.textContent = String(count);
  Object.assign(label.style, {
    position: "absolute",
    left: "0",
    top: "0",
    fontFamily: "var(--font-geist-mono, ui-monospace, monospace)",
    fontSize: "10.5px",
    fontWeight: "700",
    lineHeight: "1",
    color: "#16161f",
    pointerEvents: "none",
    willChange: "transform"
  });
  return label;
}

function replaceMarkers(globe: GlobeScene, clusters: GlobeCluster[], labelLayer: HTMLDivElement | null) {
  const previousMarkers = new Map(globe.markers.map(marker => [marker.cluster.id, marker]));
  for (const marker of globe.markers) {
    globe.markerGroup.remove(marker.mesh, marker.halo);
    marker.mesh.material.dispose();
    marker.halo.material.dispose();
  }
  globe.labels.forEach(label => label.remove());
  globe.labels.clear();
  labelLayer?.replaceChildren();

  const isIntroPlaying = !!globe.intro;
  globe.markers = clusters.map(cluster => {
    const previous = previousMarkers.get(cluster.id);
    const position = toSurfacePoint(cluster.lat, cluster.lng, MARKER_ALTITUDE);
    const mesh = new Mesh(globe.markerGeometry, new MeshBasicMaterial({ color: new Color(globe.palette.pin), transparent: true, opacity: 1 }));
    const halo = new Mesh(globe.markerGeometry, new MeshBasicMaterial({ color: new Color(globe.palette.glow), transparent: true, opacity: 0.14 }));
    mesh.position.copy(position);
    halo.position.copy(position);
    globe.markerGroup.add(mesh, halo);
    return {
      cluster,
      mesh,
      halo,
      scale: previous?.scale ?? 0,
      radius: 0.021 + Math.min(0.016, Math.sqrt(cluster.providerIds.length - 1) * 0.009),
      ignitesAt: (cluster.lng + 180) / 360,
      ignited: previous?.ignited ?? !isIntroPlaying
    };
  });
}

function faceCoordinates(globe: GlobeScene, lat: number, lng: number) {
  globe.targetYaw = nearestEquivalentYaw(globe.yaw, Math.PI / 2 - ((lng + 180) * Math.PI) / 180);
  globe.targetPitch = Math.max(-0.8, Math.min(0.8, (lat * Math.PI) / 180));
  globe.yawEaseStartedAt = performance.now();
  globe.autoSpin = false;
}

/** Spinning accumulates yaw past 2π, so the target is moved to the turn nearest the current one to avoid unwinding whole revolutions. */
function nearestEquivalentYaw(current: number, target: number): number {
  const fullTurn = Math.PI * 2;
  return target + Math.round((current - target) / fullTurn) * fullTurn;
}

function toSurfacePoint(lat: number, lng: number, radius: number): Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}

function clampDistance(distance: number): number {
  return Math.max(CAMERA_NEAR, Math.min(CAMERA_FAR, distance));
}

function disposeScene(globe: GlobeScene) {
  globe.labels.forEach(label => label.remove());
  globe.scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => {
      if (material instanceof MeshBasicMaterial) material.map?.dispose();
      material.dispose();
    });
  });
  globe.renderer.dispose();
}
