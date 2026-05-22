"use client";

import { useMemo } from "react";

import { PhasedDeploymentProgress } from "@src/components/deployments/PhasedDeploymentProgress/PhasedDeploymentProgress";
import type { GlobeMarker } from "@src/components/globe/Globe/Globe";
import { Globe } from "@src/components/globe/Globe/Globe";
import { usePhasedDeploymentFlow } from "@src/hooks/usePhasedDeploymentFlow/usePhasedDeploymentFlow";
import useCookieTheme from "@src/hooks/useTheme";
import { useProviderList } from "@src/queries/useProvidersQuery";
import type { ApiProviderList } from "@src/types/provider";

const DEFAULT_DEPOSIT_USD = 0.5;

/** Lifts a focused marker vertically toward the top of the visible cap of the oversized globe (negative = up from sphere center). */
const GLOBE_FOCUS_BIAS_Y = -0.75;
/** Horizontal offset of a focused marker from the camera meridian; `0` rests it on the centerline. */
const GLOBE_FOCUS_BIAS_X = 0;
/** Marker dot radius (fraction of sphere radius); smaller than the cobe default because the globe is rendered oversized via {@link GLOBE_CONTAINER_SIZE} and clipped to a top cap, so the default dots read as oversized relative to the visible region. */
const GLOBE_MARKER_SIZE = 0.01;
/**
 * Square diameter of the globe container, expressed so the sphere always overshoots the viewport
 * on both axes. `220vh` keeps the sphere tall enough to extend below the visible cap on landscape
 * viewports; `120vw` caps it on tall/portrait viewports where `220vh` would be absurdly large.
 * `min()` of the two guarantees the container stays square (cobe inscribes the sphere into the
 * smaller dimension, so width and height must match to avoid wasted canvas space).
 */
const GLOBE_CONTAINER_SIZE = "min(220vh, 120vw)";

export const DEPENDENCIES = {
  useProviderList,
  usePhasedDeploymentFlow,
  PhasedDeploymentProgress,
  useTheme: useCookieTheme,
  Globe
};

type PhasedDeploymentContainerProps = {
  templateName: string;
  sdl: string;
  deposit?: number;
  onSuccess?: (dseq: string) => void;
  onCancel?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export function PhasedDeploymentContainer({
  templateName,
  sdl,
  deposit = DEFAULT_DEPOSIT_USD,
  onSuccess,
  onCancel,
  dependencies: d = DEPENDENCIES
}: PhasedDeploymentContainerProps) {
  const documentTheme = d.useTheme();
  const { data: providers } = d.useProviderList();
  const { state, progressPercent, phases, matchedProviderAddress, startOver } = d.usePhasedDeploymentFlow({
    sdl,
    deposit,
    onSuccess: dseq => onSuccess?.(dseq)
  });

  const GLOBE_COBE_OPTIONS = useMemo(
    () => ({
      mapSamples: 32000,
      dark: 1,
      diffuse: 0,
      mapBrightness: documentTheme === "dark" ? 3 : 1,
      glowColor: (documentTheme === "dark" ? [0.05, 0.05, 0.05] : [1, 1, 1]) as [number, number, number]
    }),
    [documentTheme]
  );

  const selectedProvider = useMemo(() => {
    if (!matchedProviderAddress || !providers) return null;

    const provider = providers.find(candidate => candidate.owner === matchedProviderAddress);

    if (!provider) return null;

    return { id: provider.owner, label: provider.name ?? provider.hostUri };
  }, [matchedProviderAddress, providers]);

  const focusedMarker = useMemo(() => {
    if (!selectedProvider || !providers) return null;

    const provider = providers.find(candidate => candidate.owner === selectedProvider.id);

    if (!provider) return null;

    const lat = parseFloat(provider.ipLat);
    const lng = parseFloat(provider.ipLon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  }, [providers, selectedProvider]);

  const markers = useMemo<GlobeMarker[]>(() => {
    if (!providers) return [];

    if (selectedProvider) {
      const provider = providers.find(candidate => candidate.owner === selectedProvider.id);

      if (!provider) return [];

      const marker = providerToMarker(provider);

      if (!marker) return [];

      return [marker];
    }

    return providers
      .filter(provider => provider.isOnline)
      .map(providerToMarker)
      .filter((marker): marker is GlobeMarker => marker !== null);
  }, [providers, selectedProvider]);

  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="w-[632px] max-w-full px-[20px] pt-[80px]">
        <d.PhasedDeploymentProgress
          state={state}
          templateName={templateName}
          progressPercent={progressPercent}
          phases={phases}
          onStartOver={() => {
            startOver();
            onCancel?.();
          }}
          onContactSupport={() => {
            window.open("https://akash.network/discord", "_blank", "noopener,noreferrer");
          }}
        />
      </div>
      <div aria-hidden className="relative w-full flex-1 overflow-hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 lg:top-[-50px]" style={{ width: GLOBE_CONTAINER_SIZE, height: GLOBE_CONTAINER_SIZE }}>
          <d.Globe
            markers={markers}
            focusedMarker={focusedMarker}
            focusScreenBiasY={GLOBE_FOCUS_BIAS_Y}
            focusScreenBiasX={GLOBE_FOCUS_BIAS_X}
            markerSize={GLOBE_MARKER_SIZE}
            surfaceTheme="dark"
            cobeOptions={GLOBE_COBE_OPTIONS}
          />
        </div>
      </div>
    </div>
  );
}

function providerToMarker(provider: ApiProviderList): GlobeMarker | null {
  const lat = parseFloat(provider.ipLat);
  const lng = parseFloat(provider.ipLon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    id: provider.owner,
    label: provider.name ?? provider.hostUri,
    lat,
    lng
  };
}
