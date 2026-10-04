"use client";
import type { FC } from "react";
import { useId, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";

import { fetchLandTopology } from "@src/components/providers/ProvidersGlobe/landTexture";
import type { ProviderCoordinates } from "@src/components/providers/providerSummary/providerSummary";
import { formatProviderLocation, parseCoordinates } from "@src/components/providers/providerSummary/providerSummary";
import { formatRegionLabel } from "@src/components/providers/RegionPill/RegionPill";
import { QueryKeys } from "@src/queries/queryKeys";
import type { ApiProviderDetail } from "@src/types/provider";
import { ProfileCard, ProfileRow } from "./ProfileCard";

const LOCATOR_SIZE = 240;
/** Tilts the view a little north of the provider, so it sits just below the middle of the disc like a pin on a map. */
const LOCATOR_TILT_DEGREES = 6;
const MEGABITS_PER_GIGABIT = 1000;

export function useLandTopology() {
  return useQuery({ queryKey: QueryKeys.getLandTopologyKey(), queryFn: fetchLandTopology, staleTime: Infinity, retry: false });
}

export const DEPENDENCIES = { useLandTopology };

type Provider = Pick<
  ApiProviderDetail,
  "ipLat" | "ipLon" | "ipRegion" | "ipCountry" | "locationRegion" | "timezone" | "networkProvider" | "networkSpeedDown" | "networkSpeedUp"
>;

type Props = {
  provider: Provider;
  dependencies?: typeof DEPENDENCIES;
};

export const LocationCard: FC<Props> = ({ provider, dependencies: d = DEPENDENCIES }) => {
  const coordinates = parseCoordinates(provider.ipLat, provider.ipLon);

  return (
    <ProfileCard title="Location & network">
      <div className="px-3.5 pb-2 pt-3">
        {coordinates && (
          <div className="mx-auto mb-2.5 max-w-[240px]">
            <LocatorGlobe coordinates={coordinates} useLandTopology={d.useLandTopology} />
          </div>
        )}
        <dl>
          <ProfileRow label="Location">{formatProviderLocation(provider.ipRegion, provider.ipCountry) ?? "—"}</ProfileRow>
          <ProfileRow label="Region">{provider.locationRegion ? formatRegionLabel(provider.locationRegion) : "—"}</ProfileRow>
          <ProfileRow label="Timezone">{provider.timezone || "—"}</ProfileRow>
          <ProfileRow label="Network">{provider.networkProvider || "—"}</ProfileRow>
          <ProfileRow label="Bandwidth">{formatBandwidth(provider.networkSpeedDown, provider.networkSpeedUp)}</ProfileRow>
        </dl>
      </div>
    </ProfileCard>
  );
};

const LocatorGlobe: FC<{ coordinates: ProviderCoordinates; useLandTopology: typeof useLandTopology }> = ({ coordinates, useLandTopology }) => {
  const { data: topology } = useLandTopology();
  const gradientId = useId();
  const center = LOCATOR_SIZE / 2;
  const radius = center - 4;

  const { landPath, graticulePath, pin } = useMemo(() => {
    const projection = geoOrthographic()
      .rotate([-coordinates.lng, -coordinates.lat + LOCATOR_TILT_DEGREES])
      .scale(radius)
      .translate([center, center])
      .clipAngle(90);
    const path = geoPath(projection);
    return {
      landPath: topology ? path(feature(topology, topology.objects.land)) : null,
      graticulePath: path(geoGraticule10()),
      pin: projection([coordinates.lng, coordinates.lat])
    };
  }, [topology, coordinates.lat, coordinates.lng, center, radius]);

  return (
    <svg viewBox={`0 0 ${LOCATOR_SIZE} ${LOCATOR_SIZE}`} className="block h-auto w-full" role="img" aria-label="Where the provider is on the globe">
      <defs>
        <radialGradient id={gradientId} cx="38%" cy="30%">
          <stop offset="0%" stopColor="#232332" />
          <stop offset="100%" stopColor="#111119" />
        </radialGradient>
      </defs>
      <circle cx={center} cy={center} r={radius} fill={`url(#${gradientId})`} className="stroke-border" />
      {graticulePath && <path d={graticulePath} fill="none" stroke="rgba(141,141,171,0.14)" strokeWidth={0.5} />}
      {landPath && <path d={landPath} fill="rgba(150,150,178,0.38)" />}
      {pin && (
        <g>
          <circle cx={pin[0]} cy={pin[1]} r={11} fill="#C98AE8" fillOpacity={0.3} />
          <circle cx={pin[0]} cy={pin[1]} r={4.5} fill="#C98AE8" stroke="#111119" strokeWidth={1.5} />
        </g>
      )}
    </svg>
  );
};

function formatBandwidth(downMbps: number, upMbps: number): string {
  if (!downMbps && !upMbps) return "—";
  return `${formatMegabits(downMbps)} ↓ · ${formatMegabits(upMbps)} ↑`;
}

function formatMegabits(megabits: number): string {
  if (!megabits) return "—";
  return megabits >= MEGABITS_PER_GIGABIT ? `${parseFloat((megabits / MEGABITS_PER_GIGABIT).toFixed(1))} Gbps` : `${megabits} Mbps`;
}
