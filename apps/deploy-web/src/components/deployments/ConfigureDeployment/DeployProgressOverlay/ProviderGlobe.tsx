"use client";
import type { FC } from "react";
import { useMemo } from "react";

import type { GlobeMarker } from "@src/components/globe/Globe/Globe";
import { Globe } from "@src/components/globe/Globe/Globe";
import useCookieTheme from "@src/hooks/useTheme";
import { useProviderList } from "@src/queries/useProvidersQuery";
import type { ApiProviderList } from "@src/types/provider";

/** Lifts a focused marker toward the top of the visible cap of the oversized globe (negative = up from sphere center). */
const GLOBE_FOCUS_BIAS_Y = -0.75;
/** Horizontal offset of a focused marker from the camera meridian; 0 rests it on the centerline. */
const GLOBE_FOCUS_BIAS_X = 0;
/** Marker dot radius (fraction of sphere radius); small because the globe is rendered oversized and clipped to a top cap. */
const GLOBE_MARKER_SIZE = 0.01;
/** Square diameter that always overshoots the viewport so the sphere fills the visible cap on any aspect ratio. */
const GLOBE_CONTAINER_SIZE = "min(220vh, 120vw)";

export const DEPENDENCIES = { useProviderList, useTheme: useCookieTheme, Globe };

interface Props {
  /** When set, the globe shows only this provider's marker and focuses the camera on it; otherwise it shows every online provider. */
  focusedProviderAddress?: string | null;
  dependencies?: typeof DEPENDENCIES;
}

/**
 * The shared provider globe behind the deploy-progress panel: every online provider while matching, narrowing
 * to the chosen provider once one is selected. Rendered by both the onboarding-driven auto flow and the manual
 * configure deploy via {@link PhasedDeployProgressScene}.
 */
export const ProviderGlobe: FC<Props> = ({ focusedProviderAddress, dependencies: d = DEPENDENCIES }) => {
  const documentTheme = d.useTheme();
  const { data: providers } = d.useProviderList();

  const cobeOptions = useMemo(() => {
    const glowColor: [number, number, number] = documentTheme === "dark" ? [0.05, 0.05, 0.05] : [1, 1, 1];
    return { mapSamples: 32000, dark: 1, diffuse: 0, mapBrightness: documentTheme === "dark" ? 3 : 1, glowColor };
  }, [documentTheme]);

  const focused = useMemo(
    () => (focusedProviderAddress && providers ? providers.find(provider => provider.owner === focusedProviderAddress) ?? null : null),
    [focusedProviderAddress, providers]
  );

  const focusedMarker = useMemo(() => {
    if (!focused) return null;
    const lat = parseFloat(focused.ipLat);
    const lng = parseFloat(focused.ipLon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [focused]);

  const markers = useMemo<GlobeMarker[]>(() => {
    if (!providers) return [];
    if (focused) {
      const marker = providerToMarker(focused);
      return marker ? [marker] : [];
    }
    return providers
      .filter(provider => provider.isOnline)
      .map(providerToMarker)
      .filter((marker): marker is GlobeMarker => marker !== null);
  }, [providers, focused]);

  return (
    <div aria-hidden className="relative w-full flex-1 overflow-hidden">
      <div className="absolute left-1/2 top-0 -translate-x-1/2 lg:top-[-50px]" style={{ width: GLOBE_CONTAINER_SIZE, height: GLOBE_CONTAINER_SIZE }}>
        <d.Globe
          markers={markers}
          focusedMarker={focusedMarker}
          focusScreenBiasY={GLOBE_FOCUS_BIAS_Y}
          focusScreenBiasX={GLOBE_FOCUS_BIAS_X}
          markerSize={GLOBE_MARKER_SIZE}
          surfaceTheme="dark"
          cobeOptions={cobeOptions}
        />
      </div>
    </div>
  );
};

/** A provider as a globe marker, or null when it has no usable coordinates. */
function providerToMarker(provider: ApiProviderList): GlobeMarker | null {
  const lat = parseFloat(provider.ipLat);
  const lng = parseFloat(provider.ipLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { id: provider.owner, label: provider.name ?? provider.hostUri, lat, lng };
}
