import { useEffect, useState } from "react";
import type { GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";

import { fetchLandTopology } from "@src/components/providers/ProvidersGlobe/landTexture";

type Topology = Awaited<ReturnType<typeof fetchLandTopology>>;

/** A failed fetch is forgotten, so the next globe retries it instead of every later one drawing without land. */
export function createLandShapeLoader(fetchTopology: () => Promise<Topology> = fetchLandTopology): () => Promise<GeoPermissibleObjects> {
  let landShape: Promise<GeoPermissibleObjects> | null = null;

  return function loadLandShape() {
    landShape ??= fetchTopology()
      .then(topology => feature(topology, topology.objects.land))
      .catch(error => {
        landShape = null;
        throw error;
      });
    return landShape;
  };
}

const loadLandShape = createLandShapeLoader();

export function useLandShape(load: () => Promise<GeoPermissibleObjects> = loadLandShape): GeoPermissibleObjects | null {
  const [landShape, setLandShape] = useState<GeoPermissibleObjects | null>(null);

  useEffect(
    function loadLandOnMount() {
      let isMounted = true;
      load().then(
        shape => {
          if (isMounted) setLandShape(shape);
        },
        () => undefined
      );
      return function ignoreLateLand() {
        isMounted = false;
      };
    },
    [load]
  );

  return landShape;
}
