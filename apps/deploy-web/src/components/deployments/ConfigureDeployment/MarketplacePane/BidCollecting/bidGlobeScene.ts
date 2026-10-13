import type { GeoPoint, GlobeView } from "./globeGeometry";
import {
  angleBetween,
  clamp,
  easeInOutCubic,
  easeOutBack,
  globeLayout,
  hashToUnit,
  interpolateGreatCircle,
  projectOnGlobe,
  RADIANS_PER_DEGREE,
  toGeoPoint
} from "./globeGeometry";

export interface LocatedProvider {
  id: string;
  lat: number;
  lng: number;
}

export interface GlobeNode extends GeoPoint {
  id: string;
  distance: number;
}

export interface GlobeField {
  key: string;
  viewer: GeoPoint;
  nodes: GlobeNode[];
  launchOrder: number[];
}

interface Arc {
  node: number;
  launchedAt: number;
  duration: number;
  hasLanded: boolean;
}

interface Pulse {
  node: number;
  startedAt: number;
}

export interface BidGlobeScene {
  field: GlobeField;
  arcs: Arc[];
  pulses: Pulse[];
  reachedAt: Map<number, number>;
  launchedCount: number;
  nextLaunchAt: number;
}

export interface BidGlobeFrame {
  seconds: number;
  bid: { providerId: string; seconds: number } | null;
  isStill: boolean;
}

export type GlobeShape =
  | { kind: "dot"; x: number; y: number; radius: number; color: string; opacity: number; glow?: { color: string; blur: number } }
  | { kind: "ring"; x: number; y: number; radiusX: number; radiusY: number; rotation: number; color: string }
  | { kind: "segment"; fromX: number; fromY: number; toX: number; toY: number; width: number; color: string };

const MAX_GLOBE_PROVIDERS = 64;
const VIEW_LEAD_RADIANS = 0.7;
const VIEW_TILT_RADIANS = 0.38;
const SPIN_RADIANS_PER_SECOND = 0.038;
const FACING_DEPTH = 0.12;

const FIRST_LAUNCH_SECONDS = 0.4;
const LAUNCH_INTERVAL_SECONDS = 0.24;
/** A tab that slept must not fire every arc it missed at once. */
const MAX_LAUNCH_BACKLOG_SECONDS = 1;
const ARC_BASE_SECONDS = 0.7;
const ARC_SECONDS_PER_HALF_TURN = 0.55;
const ARC_TAIL_LENGTH = 0.42;
const ARC_FADE_SECONDS = 0.5;
const ARC_SEGMENTS_PER_LENGTH = 30;
const PULSE_SECONDS = 0.9;
const PIN_LIGHT_UP_SECONDS = 0.3;
const VIEWER_PULSE_SECONDS = 1.2;
const REACHED_IN_STILL_FRAME = -Infinity;

const BID_REPLY_DELAY_SECONDS = 0.04;
const BID_REPLY_SECONDS = 0.55;
const BID_ARRIVAL_RING_SECONDS = 0.6;

const COLORS = {
  arc: "201,138,232",
  arcHead: "#f5ecff",
  arcHeadGlow: "#c98ae8",
  bid: "52,211,153",
  bidHead: "#d1fae5",
  bidHeadGlow: "#34d399",
  pin: "#d9b6f7",
  pinDim: "#6b5c7d",
  viewer: "#ffffff",
  viewerRing: "255,255,255",
  viewerGlow: "rgba(255,255,255,0.8)"
};

export function buildGlobeField(providers: LocatedProvider[], viewer: GeoPoint, seed: string): GlobeField {
  const nodes = providers.slice(0, MAX_GLOBE_PROVIDERS).map(function toNode(provider): GlobeNode {
    const point = toGeoPoint(provider.lng * RADIANS_PER_DEGREE, provider.lat * RADIANS_PER_DEGREE);
    return { ...point, id: provider.id, distance: angleBetween(point, viewer) };
  });
  const openingView = viewFrom(viewer, 0);
  const facesViewer = (node: GlobeNode) => projectOnGlobe(openingView, node.lng, node.lat).depth > FACING_DEPTH;
  const shuffleRank = (node: GlobeNode) => hashToUnit(`${node.id}${seed}`);
  const launchOrder = nodes
    .map((_, index) => index)
    .sort((a, b) => Number(facesViewer(nodes[b])) - Number(facesViewer(nodes[a])) || shuffleRank(nodes[a]) - shuffleRank(nodes[b]));

  return { key: `${seed}|${nodes.map(node => node.id).join(",")}`, viewer, nodes, launchOrder };
}

export function createBidGlobeScene(field: GlobeField): BidGlobeScene {
  return { field, arcs: [], pulses: [], reachedAt: new Map(), launchedCount: 0, nextLaunchAt: FIRST_LAUNCH_SECONDS };
}

export function viewAt(field: Pick<GlobeField, "viewer">, seconds: number): GlobeView {
  return viewFrom(field.viewer, seconds);
}

export function advanceBidGlobeScene(scene: BidGlobeScene, frame: BidGlobeFrame): void {
  if (frame.isStill) scene.field.nodes.forEach((_, index) => scene.reachedAt.set(index, REACHED_IN_STILL_FRAME));
  else if (!frame.bid) launchDueArcs(scene, frame.seconds);

  landArrivedArcs(scene, frame.seconds);
  scene.pulses = scene.pulses.filter(pulse => frame.seconds - pulse.startedAt < PULSE_SECONDS);

  const bidder = bidderIndexOf(scene, frame);
  if (bidder >= 0 && !scene.reachedAt.has(bidder)) scene.reachedAt.set(bidder, frame.seconds);
}

export function composeGlobeOverlay(scene: BidGlobeScene, frame: BidGlobeFrame, size: number): GlobeShape[] {
  const { center, radius, unit } = globeLayout(size);
  const view = viewAt(scene.field, frame.seconds);
  const shapes: GlobeShape[] = [];
  const bidder = bidderIndexOf(scene, frame);
  const bidSeconds = frame.bid?.seconds ?? null;
  const dimming = bidSeconds === null ? 1 : 1 - 0.4 * Math.min(1, bidSeconds / 0.3);
  const arcOpacity = bidSeconds === null ? 1 : Math.max(0, 1 - bidSeconds / 0.22);
  const { nodes, viewer } = scene.field;

  function toScreen(lng: number, lat: number, altitude = 1) {
    const point = projectOnGlobe(view, lng, lat, altitude);
    return { x: center + radius * point.x, y: center - radius * point.y, depth: point.depth, isVisible: point.isVisible };
  }

  type ScreenPoint = ReturnType<typeof toScreen>;

  function addRing(point: ScreenPoint, progress: number, rgb: string, maxRadius: number, opacity: number) {
    const ringRadius = (2 + maxRadius * (1 - (1 - progress) ** 2)) * unit;
    shapes.push({
      kind: "ring",
      x: point.x,
      y: point.y,
      radiusX: Math.max(0.1, ringRadius * Math.max(0.05, point.depth)),
      radiusY: ringRadius,
      rotation: Math.atan2(point.y - center, point.x - center),
      color: rgba(rgb, opacity * (1 - progress))
    });
  }

  function addHead(point: ScreenPoint | null, color: string, glow: string, opacity: number) {
    if (!point?.isVisible) return;
    shapes.push({ kind: "dot", x: point.x, y: point.y, radius: 1.8 * unit, color, opacity, glow: { color: glow, blur: 6 * unit } });
  }

  function addArc(from: GeoPoint, to: GeoPoint, angle: number, tail: number, head: number, rgb: string, opacity: number, fadesTowardTail: boolean) {
    const steps = Math.max(2, Math.ceil((head - tail) * ARC_SEGMENTS_PER_LENGTH));
    const lift = 0.05 + (0.13 * angle) / Math.PI;
    let previous: ScreenPoint | null = null;
    for (let step = 0; step <= steps; step++) {
      const progress = tail + (head - tail) * (step / steps);
      const [lng, lat] = interpolateGreatCircle(from, to, angle, progress);
      const point = toScreen(lng, lat, 1 + lift * Math.sin(Math.PI * progress));
      if (previous?.isVisible && point.isVisible) {
        const share = step / steps;
        const segmentOpacity = fadesTowardTail ? opacity * (0.06 + 0.94 * share ** 2) : opacity;
        shapes.push({ kind: "segment", fromX: previous.x, fromY: previous.y, toX: point.x, toY: point.y, width: 1.25 * unit, color: rgba(rgb, segmentOpacity) });
      }
      previous = point;
    }
    return previous;
  }

  nodes.forEach(function addPin(node, index) {
    if (index === bidder) return;
    const point = toScreen(node.lng, node.lat);
    if (point.depth <= 0.01) return;
    const edgeFade = Math.min(1, point.depth * 5) * dimming;
    const reachedAt = scene.reachedAt.get(index);
    const lit = reachedAt === undefined ? 0 : Math.min(1, (frame.seconds - reachedAt) / PIN_LIGHT_UP_SECONDS);
    const pinRadius = (1.5 + 0.6 * lit) * unit;
    if (lit < 1) shapes.push({ kind: "dot", x: point.x, y: point.y, radius: pinRadius, color: COLORS.pinDim, opacity: edgeFade * (1 - lit) });
    if (lit > 0) shapes.push({ kind: "dot", x: point.x, y: point.y, radius: pinRadius, color: COLORS.pin, opacity: edgeFade * lit });
  });

  scene.pulses.forEach(function addPulse(pulse) {
    if (pulse.node === bidder) return;
    const node = nodes[pulse.node];
    const point = toScreen(node.lng, node.lat);
    if (point.depth > 0.05) addRing(point, (frame.seconds - pulse.startedAt) / PULSE_SECONDS, COLORS.arc, 10, 0.8 * dimming);
  });

  if (arcOpacity > 0) {
    scene.arcs.forEach(function addLaunchedArc(arc) {
      const age = frame.seconds - arc.launchedAt;
      const head = easeInOutCubic(Math.min(1, age / arc.duration));
      const isFlying = age < arc.duration;
      const tail = isFlying ? Math.max(0, head - ARC_TAIL_LENGTH) : Math.min(1, 1 - ARC_TAIL_LENGTH + (ARC_TAIL_LENGTH * (age - arc.duration)) / ARC_FADE_SECONDS);
      if (tail >= head) return;
      const node = nodes[arc.node];
      const end = addArc(viewer, node, node.distance, tail, head, COLORS.arc, 0.9 * arcOpacity, true);
      if (isFlying) addHead(end, COLORS.arcHead, COLORS.arcHeadGlow, arcOpacity);
    });
  }

  const viewerPoint = toScreen(viewer.lng, viewer.lat);

  if (bidSeconds !== null && bidder >= 0) {
    const node = nodes[bidder];
    const replyAge = bidSeconds - BID_REPLY_DELAY_SECONDS;
    if (replyAge > 0) {
      const replyHead = easeInOutCubic(Math.min(1, replyAge / BID_REPLY_SECONDS));
      const replyEnd = addArc(node, viewer, node.distance, 0, replyHead, COLORS.bid, 0.95, false);
      if (replyAge < BID_REPLY_SECONDS) addHead(replyEnd, COLORS.bidHead, COLORS.bidHeadGlow, 1);
    }
    const bidderPoint = toScreen(node.lng, node.lat);
    if (bidderPoint.depth > 0.01) {
      addRing(bidderPoint, Math.min(1, bidSeconds / 0.8), COLORS.bid, 14, 0.9);
      const popRadius = 2.6 * unit * Math.max(0.2, easeOutBack(Math.min(1, bidSeconds / 0.22)));
      shapes.push({ kind: "dot", x: bidderPoint.x, y: bidderPoint.y, radius: popRadius, color: rgba(COLORS.bid, 1), opacity: 1 });
    }
    const arrival = (replyAge - BID_REPLY_SECONDS) / BID_ARRIVAL_RING_SECONDS;
    if (arrival > 0 && arrival < 1 && viewerPoint.depth > 0.01) addRing(viewerPoint, arrival, COLORS.bid, 14, 0.9);
  }

  if (viewerPoint.depth > 0.01) {
    if (bidSeconds === null && !frame.isStill) addRing(viewerPoint, (frame.seconds % VIEWER_PULSE_SECONDS) / VIEWER_PULSE_SECONDS, COLORS.viewerRing, 10, 0.5);
    shapes.push({
      kind: "dot",
      x: viewerPoint.x,
      y: viewerPoint.y,
      radius: 2.6 * unit,
      color: COLORS.viewer,
      opacity: 1,
      glow: { color: COLORS.viewerGlow, blur: 6 * unit }
    });
  }

  return shapes;
}

function viewFrom(viewer: GeoPoint, seconds: number): GlobeView {
  return { centerLng: viewer.lng + VIEW_LEAD_RADIANS - SPIN_RADIANS_PER_SECOND * seconds, tilt: VIEW_TILT_RADIANS };
}

function launchDueArcs(scene: BidGlobeScene, seconds: number) {
  const { nodes, launchOrder } = scene.field;
  if (nodes.length === 0) return;

  if (scene.nextLaunchAt < seconds - MAX_LAUNCH_BACKLOG_SECONDS) scene.nextLaunchAt = seconds;
  while (scene.nextLaunchAt <= seconds) {
    const node = launchOrder[scene.launchedCount % launchOrder.length];
    scene.arcs.push({ node, launchedAt: scene.nextLaunchAt, duration: ARC_BASE_SECONDS + (ARC_SECONDS_PER_HALF_TURN * nodes[node].distance) / Math.PI, hasLanded: false });
    scene.launchedCount++;
    scene.nextLaunchAt += LAUNCH_INTERVAL_SECONDS;
  }
}

function landArrivedArcs(scene: BidGlobeScene, seconds: number) {
  scene.arcs = scene.arcs.filter(function landWhenArrived(arc) {
    const landedAt = arc.launchedAt + arc.duration;
    if (seconds >= landedAt && !arc.hasLanded) {
      arc.hasLanded = true;
      if (!scene.reachedAt.has(arc.node)) scene.reachedAt.set(arc.node, landedAt);
      scene.pulses.push({ node: arc.node, startedAt: landedAt });
    }
    return seconds < landedAt + ARC_FADE_SECONDS;
  });
}

function bidderIndexOf(scene: BidGlobeScene, frame: BidGlobeFrame): number {
  return frame.bid ? scene.field.nodes.findIndex(node => node.id === frame.bid?.providerId) : -1;
}

function rgba(rgb: string, opacity: number): string {
  return `rgba(${rgb},${clamp(opacity, 0, 1).toFixed(3)})`;
}
