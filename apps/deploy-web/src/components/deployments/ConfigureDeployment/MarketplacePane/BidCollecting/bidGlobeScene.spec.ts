import { describe, expect, it } from "vitest";

import type { BidGlobeFrame, BidGlobeScene, GlobeShape, LocatedProvider } from "./bidGlobeScene";
import { advanceBidGlobeScene, buildGlobeField, composeGlobeOverlay, createBidGlobeScene, viewAt } from "./bidGlobeScene";
import type { GeoPoint } from "./globeGeometry";
import {
  angleBetween,
  easeInOutCubic,
  easeOutBack,
  hashToUnit,
  interpolateGreatCircle,
  projectOnGlobe,
  RADIANS_PER_DEGREE,
  toGeoPoint
} from "./globeGeometry";

const VIEWER = toGeoPoint(-0.7, 0);
const FRONT: LocatedProvider = { id: "front", lat: 0, lng: 0 };
const NORTH: LocatedProvider = { id: "north", lat: 40, lng: 20 };
const BEHIND: LocatedProvider = { id: "behind", lat: 0, lng: 180 };
const NEAR_EDGE: LocatedProvider = { id: "near-edge", lat: 0, lng: 84 };
const AT_EDGE: LocatedProvider = { id: "at-edge", lat: 0, lng: 87 };
const SIZE = 280;
const ARC = "201,138,232";
const BID = "52,211,153";

describe(buildGlobeField.name, () => {
  it("places each provider at its coordinates and measures its distance from the viewer", () => {
    const field = buildGlobeField([NORTH], VIEWER, "seed");
    const north = toGeoPoint(20 * RADIANS_PER_DEGREE, 40 * RADIANS_PER_DEGREE);

    expect(field.viewer).toBe(VIEWER);
    expect(field.nodes).toEqual([{ ...north, id: "north", distance: angleBetween(north, VIEWER) }]);
  });

  it("keeps the first 64 providers", () => {
    const providers = Array.from({ length: 70 }, (_, index) => ({ id: `p${index}`, lat: 0, lng: index }));

    expect(buildGlobeField(providers, VIEWER, "seed").nodes.map(node => node.id)).toEqual(providers.slice(0, 64).map(provider => provider.id));
  });

  it.each(["seed", "placement-2"])("reaches the providers facing the viewer first, each group shuffled by the seed (%s)", seed => {
    const providers = [BEHIND, AT_EDGE, FRONT, NORTH];
    const shuffled = (ids: string[]) => [...ids].sort((a, b) => hashToUnit(`${a}${seed}`) - hashToUnit(`${b}${seed}`));

    const field = buildGlobeField(providers, VIEWER, seed);

    expect(field.launchOrder.map(index => providers[index].id)).toEqual([...shuffled(["front", "north"]), ...shuffled(["behind", "at-edge"])]);
  });

  it("keys the field by its seed and providers, so the same providers keep the same animation", () => {
    expect(buildGlobeField([FRONT, NORTH], VIEWER, "seed").key).toBe("seed|front,north");
  });
});

describe(viewAt.name, () => {
  it("starts just east of the viewer and turns eastward", () => {
    expect(viewAt({ viewer: VIEWER }, 0)).toEqual({ centerLng: VIEWER.lng + 0.7, tilt: 0.38 });
    expect(viewAt({ viewer: VIEWER }, 10).centerLng).toBeCloseTo(VIEWER.lng + 0.7 - 0.38);
  });
});

describe(advanceBidGlobeScene.name, () => {
  it("launches the first arc 0.4 s in, then one every 0.24 s", () => {
    const { scene, playTo } = setup([FRONT]);

    playTo(0.39);
    expect(scene.arcs).toEqual([]);

    playTo(0.9);
    expect(scene.arcs.map(arc => arc.launchedAt)).toEqual([0.4, expect.closeTo(0.64), expect.closeTo(0.88)]);
  });

  it("gives an arc more time the farther its provider is", () => {
    const { scene, playTo } = setup([FRONT, NORTH]);

    playTo(0.64);

    expect(scene.arcs.map(arc => [scene.field.nodes[arc.node].id, arc.duration])).toEqual(
      scene.field.launchOrder.map(index => [scene.field.nodes[index].id, 0.7 + (0.55 * scene.field.nodes[index].distance) / Math.PI])
    );
  });

  it("reaches every provider in launch order, then starts over", () => {
    const { scene, playTo } = setup([FRONT, NORTH]);

    playTo(0.88);

    const [first, second] = scene.field.launchOrder;
    expect(scene.arcs.map(arc => arc.node)).toEqual([first, second, first]);
  });

  it("catches up on the arcs it missed within a second", () => {
    const { scene, playTo, advanceTo } = setup([FRONT]);
    playTo(0.4);

    advanceTo(1.3);

    expect(scene.arcs.map(arc => arc.launchedAt)).toEqual([0.4, expect.closeTo(0.64), expect.closeTo(0.88), expect.closeTo(1.12)]);
  });

  it("picks up from now after a tab slept instead of firing every arc it missed", () => {
    const { scene, playTo, advanceTo } = setup([FRONT]);
    playTo(0.4);

    advanceTo(5);

    expect(scene.arcs.map(arc => arc.launchedAt)).toEqual([5]);
  });

  it("lights a provider and rings it when an arc reaches it", () => {
    const { scene, playTo } = setup([FRONT]);
    const landedAt = 0.4 + arcDuration(scene, 0);

    playTo(landedAt);

    expect(scene.reachedAt).toEqual(new Map([[0, landedAt]]));
    expect(scene.pulses).toEqual([{ node: 0, startedAt: landedAt }]);
    expect(scene.arcs[0]).toMatchObject({ launchedAt: 0.4, hasLanded: true });
  });

  it("keeps the time a provider was first reached", () => {
    const { scene, playTo } = setup([FRONT]);
    const duration = arcDuration(scene, 0);

    playTo(0.64 + duration);

    expect(scene.reachedAt.get(0)).toBe(0.4 + duration);
    expect(scene.pulses.map(pulse => pulse.startedAt)).toEqual([0.4 + duration, expect.closeTo(0.64 + duration)]);
  });

  it("lets an arc trail off for half a second after it lands", () => {
    const { scene, playTo } = setup([FRONT]);
    const landedAt = 0.4 + arcDuration(scene, 0);

    playTo(landedAt + 0.49);
    expect(scene.arcs[0].launchedAt).toBe(0.4);

    playTo(landedAt + 0.5);
    expect(scene.arcs[0].launchedAt).not.toBe(0.4);
  });

  it("ends a provider's ring after 0.9 s", () => {
    const { scene, playTo } = setup([FRONT]);
    const landedAt = 0.4 + arcDuration(scene, 0);

    playTo(landedAt + 0.89);
    expect(scene.pulses[0].startedAt).toBe(landedAt);

    playTo(landedAt + 0.91);
    expect(scene.pulses[0].startedAt).not.toBe(landedAt);
  });

  it("launches nothing without providers", () => {
    const { scene, playTo } = setup([]);

    playTo(3);

    expect(scene.arcs).toEqual([]);
  });

  it("stops launching once a bid lands", () => {
    const { scene, playTo } = setup([FRONT]);
    playTo(0.5);

    playTo(1, { bid: { providerId: "front", seconds: 0 } });

    expect(scene.arcs.map(arc => arc.launchedAt)).toEqual([0.4]);
  });

  it("lights every provider at once and launches nothing in a still frame", () => {
    const { scene, advanceTo } = setup([FRONT, NORTH]);

    advanceTo(2.4, { isStill: true });

    expect(scene.arcs).toEqual([]);
    expect(scene.reachedAt).toEqual(
      new Map([
        [0, -Infinity],
        [1, -Infinity]
      ])
    );
  });

  it("counts the bidder as reached the moment its bid lands", () => {
    const { scene, advanceTo } = setup([FRONT, NORTH]);

    advanceTo(0.2, { bid: { providerId: "north", seconds: 0 } });

    expect(scene.reachedAt).toEqual(new Map([[1, 0.2]]));
  });

  it("keeps the time an arc reached the bidder before its bid landed", () => {
    const { scene, playTo } = setup([FRONT]);
    const landedAt = 0.4 + arcDuration(scene, 0);
    playTo(landedAt);

    playTo(landedAt + 0.1, { bid: { providerId: "front", seconds: 0 } });

    expect(scene.reachedAt.get(0)).toBe(landedAt);
  });

  it("reaches nobody for a bidder that isn't on the globe", () => {
    const { scene, advanceTo } = setup([FRONT]);

    advanceTo(0.2, { bid: { providerId: "elsewhere", seconds: 0 } });

    expect(scene.reachedAt.size).toBe(0);
  });

  function arcDuration(scene: BidGlobeScene, node: number) {
    return 0.7 + (0.55 * scene.field.nodes[node].distance) / Math.PI;
  }

  function setup(providers: LocatedProvider[]) {
    const scene = sceneWith(providers);
    let now = 0;
    const advanceTo = (seconds: number, overrides: Partial<BidGlobeFrame> = {}) => {
      now = seconds;
      advanceBidGlobeScene(scene, frameAt(seconds, overrides));
    };
    const playTo = (seconds: number, overrides: Partial<BidGlobeFrame> = {}) => {
      while (now + 0.05 < seconds) advanceTo(now + 0.05, overrides);
      advanceTo(seconds, overrides);
    };

    return { scene, playTo, advanceTo };
  }
});

describe(composeGlobeOverlay.name, () => {
  describe("viewer", () => {
    it("marks the viewer with a glowing white dot", () => {
      const viewer = screenPoint(0, VIEWER.lng, VIEWER.lat);

      expect(compose(sceneWith([]), {})).toContainEqual({
        kind: "dot",
        x: viewer.x,
        y: viewer.y,
        radius: 2.6,
        color: "#ffffff",
        opacity: 1,
        glow: { color: "rgba(255,255,255,0.8)", blur: 6 }
      });
    });

    it("rings out of the viewer every 1.2 s while waiting", () => {
      const viewer = screenPoint(0.6, VIEWER.lng, VIEWER.lat);

      const rings = ringsAt(compose(sceneWith([]), { seconds: 0.6 }), viewer);

      expect(rings).toEqual([ring(viewer, 9.5, "rgba(255,255,255,0.250)")]);
    });

    it.each<[string, Partial<BidGlobeFrame>]>([
      ["in a still frame", { isStill: true }],
      ["once a bid lands", { bid: { providerId: "front", seconds: 0.1 } }]
    ])("stops ringing out of the viewer %s", (_, frame) => {
      const viewer = screenPoint(0.6, VIEWER.lng, VIEWER.lat);

      expect(ringsAt(compose(sceneWith([FRONT]), { seconds: 0.6, ...frame }), viewer)).toEqual([]);
    });

    it("drops the viewer once the globe turned it away", () => {
      expect(compose(sceneWith([]), { seconds: 84 })).toEqual([]);
    });

    it("scales every size with the canvas", () => {
      const shapes = composeGlobeOverlay(sceneWith([]), frameAt(0), SIZE * 2);

      expect(shapes.find(shape => shape.kind === "dot")).toMatchObject({ radius: 5.2, glow: { blur: 12 } });
    });
  });

  describe("providers", () => {
    it("draws a provider no arc reached yet as a dim pin", () => {
      const front = screenOf(FRONT, 0);

      expect(dotsAt(compose(sceneWith([FRONT]), {}), front)).toEqual([{ kind: "dot", x: front.x, y: front.y, radius: 1.5, color: "#6b5c7d", opacity: 1 }]);
    });

    it("lights a reached provider up over 0.3 s", () => {
      const scene = sceneWith([FRONT]);
      scene.reachedAt.set(0, 1);
      const front = screenOf(FRONT, 1.15);

      expect(dotsAt(compose(scene, { seconds: 1.15 }), front)).toEqual([
        { kind: "dot", x: front.x, y: front.y, radius: expect.closeTo(1.8), color: "#6b5c7d", opacity: expect.closeTo(0.5) },
        { kind: "dot", x: front.x, y: front.y, radius: expect.closeTo(1.8), color: "#d9b6f7", opacity: expect.closeTo(0.5) }
      ]);
      expect(dotsAt(compose(scene, { seconds: 1.3 }), screenOf(FRONT, 1.3))).toEqual([
        { kind: "dot", x: expect.any(Number), y: expect.any(Number), radius: expect.closeTo(2.1), color: "#d9b6f7", opacity: 1 }
      ]);
    });

    it("fades pins toward the edge of the globe", () => {
      const nearEdge = screenOf(NEAR_EDGE, 0);

      expect(dotsAt(compose(sceneWith([NEAR_EDGE]), {}), nearEdge)).toEqual([expect.objectContaining({ opacity: expect.closeTo(nearEdge.depth * 5) })]);
    });

    it("leaves out providers on the far side", () => {
      const shapes = compose(sceneWith([BEHIND]), {});

      expect(shapes.filter(shape => shape.kind === "dot" && shape.color !== "#ffffff")).toEqual([]);
    });

    it("rings a provider out over 0.9 s when an arc reaches it", () => {
      const scene = sceneWith([FRONT]);
      scene.pulses = [{ node: 0, startedAt: 1 }];
      const front = screenOf(FRONT, 1.45);

      expect(ringsAt(compose(scene, { seconds: 1.45 }), front)).toEqual([ring(front, 9.5, `rgba(${ARC},0.400)`)]);
    });

    it("skips the ring of a provider right at the edge of the globe", () => {
      const scene = sceneWith([AT_EDGE]);
      scene.pulses = [{ node: 0, startedAt: 1 }];

      expect(compose(scene, { seconds: 1.45 }).filter(shape => shape.kind === "ring" && shape.color.startsWith(`rgba(${ARC}`))).toEqual([]);
    });
  });

  describe("arcs", () => {
    it("draws an arc from the viewer toward its provider, brightening toward a glowing head", () => {
      const scene = sceneWith([NORTH]);
      scene.arcs = [{ node: 0, launchedAt: 0, duration: 1, hasLanded: false }];

      const shapes = compose(scene, { seconds: 0.5 });

      const segments = segmentsOf(shapes, ARC);
      const head = arcPoint(scene, VIEWER, 0, 0.5, 0.5);
      const tail = arcPoint(scene, VIEWER, 0, 0.08, 0.5);
      expect(segments).toHaveLength(13);
      expect(segments[0]).toMatchObject({ fromX: expect.closeTo(tail.x), fromY: expect.closeTo(tail.y), width: 1.25, color: `rgba(${ARC},0.059)` });
      expect(segments[12]).toMatchObject({ toX: expect.closeTo(head.x), toY: expect.closeTo(head.y), color: `rgba(${ARC},0.900)` });
      expect(shapes).toContainEqual({
        kind: "dot",
        x: expect.closeTo(head.x),
        y: expect.closeTo(head.y),
        radius: 1.8,
        color: "#f5ecff",
        opacity: 1,
        glow: { color: "#c98ae8", blur: 6 }
      });
    });

    it("pulls the tail in after the arc lands and drops its head", () => {
      const scene = sceneWith([NORTH]);
      scene.arcs = [{ node: 0, launchedAt: 0, duration: 1, hasLanded: true }];

      const shapes = compose(scene, { seconds: 1.25 });

      const tail = arcPoint(scene, VIEWER, 0, 0.79, 1.25);
      expect(segmentsOf(shapes, ARC)).toHaveLength(7);
      expect(segmentsOf(shapes, ARC)[0]).toMatchObject({ fromX: expect.closeTo(tail.x), fromY: expect.closeTo(tail.y) });
      expect(shapes.filter(shape => shape.kind === "dot" && shape.color === "#f5ecff")).toEqual([]);
    });

    it("draws nothing of an arc whose tail reached its provider", () => {
      const scene = sceneWith([NORTH]);
      scene.arcs = [{ node: 0, launchedAt: 0, duration: 1, hasLanded: true }];

      expect(segmentsOf(compose(scene, { seconds: 1.5 }), ARC)).toEqual([]);
    });

    it("hides the part of an arc behind the globe", () => {
      const scene = sceneWith([BEHIND]);
      scene.arcs = [{ node: 0, launchedAt: 0, duration: 1, hasLanded: false }];

      expect(segmentsOf(compose(scene, { seconds: 0.7 }), ARC)).toHaveLength(3);
    });
  });

  describe("when a bid lands", () => {
    it("fades the arcs out over 0.22 s", () => {
      const scene = sceneWith([FRONT, NORTH]);
      scene.arcs = [{ node: 1, launchedAt: 0, duration: 1, hasLanded: false }];

      const fading = compose(scene, { seconds: 0.5, bid: { providerId: "front", seconds: 0.11 } });
      const gone = compose(scene, { seconds: 0.5, bid: { providerId: "front", seconds: 0.22 } });

      expect(segmentsOf(fading, ARC).at(-1)).toMatchObject({ color: `rgba(${ARC},0.450)` });
      expect(fading.find(shape => shape.kind === "dot" && shape.color === "#f5ecff")).toMatchObject({ opacity: expect.closeTo(0.5) });
      expect(segmentsOf(gone, ARC)).toEqual([]);
      expect(gone.filter(shape => shape.kind === "dot" && shape.color === "#f5ecff")).toEqual([]);
    });

    it("dims the other providers to 60% over 0.3 s", () => {
      const north = screenOf(NORTH, 1);

      const dimming = dotsAt(compose(sceneWith([FRONT, NORTH]), { seconds: 1, bid: { providerId: "front", seconds: 0.15 } }), north);
      const dimmed = dotsAt(compose(sceneWith([FRONT, NORTH]), { seconds: 1, bid: { providerId: "front", seconds: 0.6 } }), north);

      expect(dimming).toEqual([expect.objectContaining({ opacity: expect.closeTo(0.8) })]);
      expect(dimmed).toEqual([expect.objectContaining({ opacity: expect.closeTo(0.6) })]);
    });

    it("pops the bidder in green in place of its pin and ring", () => {
      const scene = sceneWith([FRONT]);
      scene.pulses = [{ node: 0, startedAt: 0.9 }];
      const front = screenOf(FRONT, 1);

      const shapes = compose(scene, { seconds: 1, bid: { providerId: "front", seconds: 0.4 } });

      expect(dotsAt(shapes, front)).toEqual([{ kind: "dot", x: front.x, y: front.y, radius: expect.closeTo(2.6), color: `rgba(${BID},1.000)`, opacity: 1 }]);
      expect(ringsAt(shapes, front)).toEqual([ring(front, 12.5, `rgba(${BID},0.450)`)]);
    });

    it.each([
      { seconds: 0, radius: 2.6 * 0.2 },
      { seconds: 0.11, radius: 2.6 * easeOutBack(0.5) }
    ])("springs the bidder's dot open ($seconds s in)", ({ seconds, radius }) => {
      const front = screenOf(FRONT, 1);

      const shapes = compose(sceneWith([FRONT]), { seconds: 1, bid: { providerId: "front", seconds } });

      expect(dotsAt(shapes, front)).toEqual([expect.objectContaining({ radius: expect.closeTo(radius) })]);
    });

    it("answers the viewer from the bidder in green", () => {
      const scene = sceneWith([NORTH]);

      const shapes = compose(scene, { seconds: 1, bid: { providerId: "north", seconds: 0.04 + 0.33 } });

      const head = arcPoint(scene, toGeoPoint(NORTH.lng * RADIANS_PER_DEGREE, NORTH.lat * RADIANS_PER_DEGREE), 0, easeInOutCubic(0.6), 1, VIEWER);
      const answer = segmentsOf(shapes, BID);
      expect(answer.length).toBeGreaterThan(0);
      expect(answer.every(segment => segment.color === `rgba(${BID},0.950)`)).toBe(true);
      expect(answer.at(-1)).toMatchObject({ toX: expect.closeTo(head.x), toY: expect.closeTo(head.y) });
      expect(shapes).toContainEqual({
        kind: "dot",
        x: expect.closeTo(head.x),
        y: expect.closeTo(head.y),
        radius: 1.8,
        color: "#d1fae5",
        opacity: 1,
        glow: { color: "#34d399", blur: 6 }
      });
    });

    it("waits a moment before answering", () => {
      expect(segmentsOf(compose(sceneWith([NORTH]), { seconds: 1, bid: { providerId: "north", seconds: 0.03 } }), BID)).toEqual([]);
    });

    it("drops the answer's head once it reached the viewer", () => {
      const shapes = compose(sceneWith([NORTH]), { seconds: 1, bid: { providerId: "north", seconds: 0.6 } });

      expect(segmentsOf(shapes, BID).length).toBeGreaterThan(0);
      expect(shapes.filter(shape => shape.kind === "dot" && shape.color === "#d1fae5")).toEqual([]);
    });

    it("rings the viewer in green as the answer arrives", () => {
      const viewer = screenPoint(1, VIEWER.lng, VIEWER.lat);

      const arriving = compose(sceneWith([NORTH]), { seconds: 1, bid: { providerId: "north", seconds: 0.04 + 0.55 + 0.3 } });
      const arrived = compose(sceneWith([NORTH]), { seconds: 1, bid: { providerId: "north", seconds: 0.04 + 0.55 + 0.65 } });

      expect(ringsAt(arriving, viewer)).toEqual([ring(viewer, 12.5, `rgba(${BID},0.450)`)]);
      expect(ringsAt(arrived, viewer)).toEqual([]);
    });

    it("leaves out the green answer for a bidder that isn't on the globe", () => {
      const shapes = compose(sceneWith([FRONT]), { seconds: 1, bid: { providerId: "elsewhere", seconds: 0.5 } });

      expect(shapes.filter(shape => JSON.stringify(shape).includes(BID))).toEqual([]);
    });
  });

  function compose(scene: BidGlobeScene, frame: Partial<BidGlobeFrame>) {
    return composeGlobeOverlay(scene, frameAt(frame.seconds ?? 0, frame), SIZE);
  }

  function screenOf(provider: LocatedProvider, seconds: number) {
    return screenPoint(seconds, provider.lng * RADIANS_PER_DEGREE, provider.lat * RADIANS_PER_DEGREE);
  }

  function arcPoint(scene: BidGlobeScene, from: GeoPoint, node: number, progress: number, seconds: number, to: GeoPoint = scene.field.nodes[node]) {
    const distance = scene.field.nodes[node].distance;
    const [lng, lat] = interpolateGreatCircle(from, to, distance, progress);
    return screenPoint(seconds, lng, lat, 1 + (0.05 + (0.13 * distance) / Math.PI) * Math.sin(Math.PI * progress));
  }

  function dotsAt(shapes: GlobeShape[], point: { x: number; y: number }) {
    return shapes.filter(shape => shape.kind === "dot" && isAt(shape, point));
  }

  function ringsAt(shapes: GlobeShape[], point: { x: number; y: number }) {
    return shapes.filter(shape => shape.kind === "ring" && isAt(shape, point));
  }

  function segmentsOf(shapes: GlobeShape[], rgb: string) {
    return shapes.filter((shape): shape is Extract<GlobeShape, { kind: "segment" }> => shape.kind === "segment" && shape.color.startsWith(`rgba(${rgb},`));
  }

  function ring(point: { x: number; y: number; depth: number }, radius: number, color: string) {
    return {
      kind: "ring",
      x: point.x,
      y: point.y,
      radiusX: expect.closeTo(radius * point.depth),
      radiusY: expect.closeTo(radius),
      rotation: expect.closeTo(Math.atan2(point.y - SIZE / 2, point.x - SIZE / 2)),
      color
    };
  }

  function isAt(shape: { x: number; y: number }, point: { x: number; y: number }) {
    return Math.abs(shape.x - point.x) < 1e-9 && Math.abs(shape.y - point.y) < 1e-9;
  }
});

function sceneWith(providers: LocatedProvider[]) {
  return createBidGlobeScene(buildGlobeField(providers, VIEWER, "seed"));
}

function frameAt(seconds: number, overrides: Partial<BidGlobeFrame> = {}): BidGlobeFrame {
  return { bid: null, isStill: false, ...overrides, seconds };
}

function screenPoint(seconds: number, lng: number, lat: number, altitude = 1) {
  const point = projectOnGlobe(viewAt({ viewer: VIEWER }, seconds), lng, lat, altitude);
  return { x: SIZE / 2 + SIZE * 0.4 * point.x, y: SIZE / 2 - SIZE * 0.4 * point.y, depth: point.depth };
}
