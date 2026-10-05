export type GlobeProvider = {
  id: string;
  lat: number;
  lng: number;
  location: string | null;
  gpuCount: number;
  vcpuCount: number;
};

export type GlobeCluster = {
  id: string;
  lat: number;
  lng: number;
  providerIds: string[];
  gpuCount: number;
  label: string;
};

export const UNKNOWN_LOCATION_LABEL = "Unknown location";

/** The cluster radius at the widest zoom, wide enough to merge a continent's providers into one pin. */
const WIDEST_CLUSTER_RADIUS_DEGREES = 11.5;
/** The cluster radius at the tightest zoom, small enough to split providers a few kilometres apart. */
const TIGHTEST_CLUSTER_RADIUS_DEGREES = 1.2;

export function clusterRadiusForZoom(zoomLevel: number): number {
  const clamped = Math.min(1, Math.max(0, zoomLevel));
  return WIDEST_CLUSTER_RADIUS_DEGREES - (WIDEST_CLUSTER_RADIUS_DEGREES - TIGHTEST_CLUSTER_RADIUS_DEGREES) * clamped;
}

/** Greedy and deterministic: the largest provider seeds a cluster and absorbs everyone within the radius, so pins never reshuffle between renders. */
export function clusterProviders(providers: GlobeProvider[], radiusDegrees: number): GlobeCluster[] {
  const maxAngle = (radiusDegrees * Math.PI) / 180;
  const points = providers.map(provider => ({ provider, vector: toUnitVector(provider.lat, provider.lng) })).sort(compareBySize);
  const taken = new Set<string>();
  const clusters: GlobeCluster[] = [];

  for (const seed of points) {
    if (taken.has(seed.provider.id)) continue;

    const members = points.filter(point => !taken.has(point.provider.id) && angleBetween(seed.vector, point.vector) <= maxAngle).map(point => point.provider);
    members.forEach(member => taken.add(member.id));
    clusters.push(toCluster(seed.provider.id, members));
  }

  return clusters;
}

function toCluster(seedId: string, members: GlobeProvider[]): GlobeCluster {
  const locations = new Set(members.map(member => member.location ?? UNKNOWN_LOCATION_LABEL));

  return {
    id: `cluster-${seedId}`,
    lat: average(members.map(member => member.lat)),
    lng: averageLongitude(members.map(member => member.lng)),
    providerIds: members.map(member => member.id),
    gpuCount: members.reduce((total, member) => total + member.gpuCount, 0),
    label: locations.size === 1 ? [...locations][0] : `${members.length} providers`
  };
}

type Point = { provider: GlobeProvider; vector: [number, number, number] };

function compareBySize(a: Point, b: Point): number {
  return b.provider.gpuCount - a.provider.gpuCount || b.provider.vcpuCount - a.provider.vcpuCount || a.provider.id.localeCompare(b.provider.id);
}

function toUnitVector(lat: number, lng: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return [-Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
}

function angleBetween(a: [number, number, number], b: [number, number, number]): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.min(1, Math.max(-1, dot)));
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/** Averages on the circle, so members on both sides of the antimeridian don't land the pin on the far side of the globe. */
function averageLongitude(longitudes: number[]): number {
  const x = average(longitudes.map(lng => Math.cos((lng * Math.PI) / 180)));
  const y = average(longitudes.map(lng => Math.sin((lng * Math.PI) / 180)));
  return (Math.atan2(y, x) * 180) / Math.PI;
}
