import { geoEquirectangular, geoGraticule10, geoPath } from "d3-geo";
import { feature } from "topojson-client";

export const LAND_TOPOLOGY_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json";

type Topology = Parameters<typeof feature>[0];

const TEXTURE_WIDTH = 4096;
const TEXTURE_HEIGHT = 2048;

/** Rasterizes the graticule and land masses onto an equirectangular canvas once; a failed fetch draws a grid-only globe and is retried on the next load. */
export function createLandCanvasLoader(fetchTopology: () => Promise<Topology> = fetchLandTopology): () => Promise<HTMLCanvasElement> {
  let landCanvas: Promise<HTMLCanvasElement> | null = null;

  return function loadLandCanvas() {
    landCanvas ??= drawLandCanvas(fetchTopology, () => {
      landCanvas = null;
    });
    return landCanvas;
  };
}

export const loadLandCanvas = createLandCanvasLoader();

async function drawLandCanvas(fetchTopology: () => Promise<Topology>, forgetFailedDrawing: () => void): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  const projection = geoEquirectangular()
    .translate([TEXTURE_WIDTH / 2, TEXTURE_HEIGHT / 2])
    .scale(TEXTURE_WIDTH / (2 * Math.PI));
  const path = geoPath(projection, context);

  context.lineWidth = 2.6;
  context.strokeStyle = "rgba(141,141,171,0.26)";
  context.beginPath();
  path(geoGraticule10());
  context.stroke();

  try {
    const topology = await fetchTopology();
    const land = feature(topology, topology.objects.land);
    context.fillStyle = "rgba(150,150,178,0.4)";
    context.beginPath();
    path(land);
    context.fill();
    context.lineWidth = 3;
    context.strokeStyle = "rgba(176,176,206,0.42)";
    context.beginPath();
    path(land);
    context.stroke();
  } catch {
    forgetFailedDrawing();
  }

  return canvas;
}

export async function fetchLandTopology(): Promise<Topology> {
  const response = await fetch(LAND_TOPOLOGY_URL);
  if (!response.ok) throw new Error(`Land topology answered ${response.status}`);
  return response.json();
}
