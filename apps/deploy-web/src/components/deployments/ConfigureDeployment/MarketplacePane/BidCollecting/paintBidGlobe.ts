import type { GeoPermissibleObjects } from "d3-geo";
import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";

import type { GlobeShape } from "./bidGlobeScene";
import type { GlobeView } from "./globeGeometry";
import { globeLayout, RADIANS_PER_DEGREE } from "./globeGeometry";

export interface GlobePicture {
  size: number;
  view: GlobeView;
  land: { shape: GeoPermissibleObjects; opacity: number } | null;
  shapes: GlobeShape[];
}

const FULL_TURN = Math.PI * 2;

/** The orb stays dark in both themes, like the Providers page globe. */
const ORB = {
  highlight: "#2a2a3c",
  body: "#111119",
  shadow: "#07070b",
  glow: "rgba(124,58,237,0.30)",
  graticule: "rgba(141,141,171,0.14)",
  land: "rgba(150,150,178,0.32)",
  landEdge: "rgba(176,176,206,0.34)",
  rim: "rgba(201,138,232,0.30)"
};

export function createBidGlobePainter(context: CanvasRenderingContext2D) {
  const projection = geoOrthographic().clipAngle(90).precision(0.7);
  const path = geoPath(projection, context);
  const graticule = geoGraticule10();

  return function paintBidGlobe({ size, view, land, shapes }: GlobePicture) {
    const { center, radius, unit } = globeLayout(size);

    context.save();
    context.beginPath();
    context.arc(center, center, radius, 0, FULL_TURN);
    context.shadowColor = ORB.glow;
    context.shadowBlur = 22 * unit;
    const shading = context.createRadialGradient(center - radius * 0.38, center - radius * 0.42, radius * 0.05, center, center, radius * 1.05);
    shading.addColorStop(0, ORB.highlight);
    shading.addColorStop(0.55, ORB.body);
    shading.addColorStop(1, ORB.shadow);
    context.fillStyle = shading;
    context.fill();
    context.restore();

    projection
      .translate([center, center])
      .scale(radius)
      .rotate([-view.centerLng / RADIANS_PER_DEGREE, -view.tilt / RADIANS_PER_DEGREE]);
    context.beginPath();
    path(graticule);
    context.strokeStyle = ORB.graticule;
    context.lineWidth = 0.6;
    context.stroke();

    if (land) {
      context.save();
      context.globalAlpha = land.opacity;
      context.beginPath();
      path(land.shape);
      context.fillStyle = ORB.land;
      context.fill();
      context.strokeStyle = ORB.landEdge;
      context.lineWidth = 0.5;
      context.stroke();
      context.restore();
    }

    context.beginPath();
    context.arc(center, center, radius, 0, FULL_TURN);
    context.strokeStyle = ORB.rim;
    context.lineWidth = 1;
    context.stroke();

    shapes.forEach(shape => paintShape(context, shape));
  };
}

function paintShape(context: CanvasRenderingContext2D, shape: GlobeShape) {
  context.save();
  context.beginPath();
  if (shape.kind === "dot") {
    context.globalAlpha = shape.opacity;
    if (shape.glow) {
      context.shadowColor = shape.glow.color;
      context.shadowBlur = shape.glow.blur;
    }
    context.arc(shape.x, shape.y, shape.radius, 0, FULL_TURN);
    context.fillStyle = shape.color;
    context.fill();
  } else if (shape.kind === "ring") {
    context.ellipse(shape.x, shape.y, shape.radiusX, shape.radiusY, shape.rotation, 0, FULL_TURN);
    context.strokeStyle = shape.color;
    context.lineWidth = 1;
    context.stroke();
  } else {
    context.moveTo(shape.fromX, shape.fromY);
    context.lineTo(shape.toX, shape.toY);
    context.strokeStyle = shape.color;
    context.lineWidth = shape.width;
    context.lineCap = "round";
    context.stroke();
  }
  context.restore();
}
