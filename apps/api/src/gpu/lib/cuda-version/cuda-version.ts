export type CudaMinimumDriver = { cudaVersion: string; minimumDriver: number[] };

/** The minimum Linux driver of each CUDA toolkit's GA release from NVIDIA's release notes, which name only a driver branch from 13.0 on. */
export const BUNDLED_CUDA_MINIMUM_DRIVERS: CudaMinimumDriver[] = [
  { cudaVersion: "13.4", minimumDriver: [615] },
  { cudaVersion: "13.3", minimumDriver: [610] },
  { cudaVersion: "13.2", minimumDriver: [595] },
  { cudaVersion: "13.1", minimumDriver: [590] },
  { cudaVersion: "13.0", minimumDriver: [580] },
  { cudaVersion: "12.9", minimumDriver: [575, 51, 3] },
  { cudaVersion: "12.8", minimumDriver: [570, 26] },
  { cudaVersion: "12.6", minimumDriver: [560, 28, 3] },
  { cudaVersion: "12.5", minimumDriver: [555, 42, 2] },
  { cudaVersion: "12.4", minimumDriver: [550, 54, 14] },
  { cudaVersion: "12.3", minimumDriver: [545, 23, 6] },
  { cudaVersion: "12.2", minimumDriver: [535, 54, 3] },
  { cudaVersion: "12.1", minimumDriver: [530, 30, 2] },
  { cudaVersion: "12.0", minimumDriver: [525, 60, 13] },
  { cudaVersion: "11.8", minimumDriver: [520, 61, 5] },
  { cudaVersion: "11.7", minimumDriver: [515, 43, 4] },
  { cudaVersion: "11.6", minimumDriver: [510, 39, 1] },
  { cudaVersion: "11.5", minimumDriver: [495, 29, 5] },
  { cudaVersion: "11.4", minimumDriver: [470, 42, 1] },
  { cudaVersion: "11.3", minimumDriver: [465, 19, 1] },
  { cudaVersion: "11.2", minimumDriver: [460, 27, 3] },
  { cudaVersion: "11.1", minimumDriver: [455, 23] },
  { cudaVersion: "11.0", minimumDriver: [450, 51, 5] }
];

export const NVIDIA_DRIVER_VERSION = /^\d{3}\.\d{1,3}(\.\d{1,3})?$/;

const CUDA_COMPAT_PACKAGE = /cuda-compat-(\d+)-(\d+)_(\d{3}\.\d{1,3}(?:\.\d{1,3})?)-/g;

/** The newest CUDA toolkit a driver meets the minimum of, so a driver newer than the table understates its support rather than guessing. */
export function getMaxCudaVersion(driverVersion: string, minimumDrivers: CudaMinimumDriver[]): string | null {
  if (!NVIDIA_DRIVER_VERSION.test(driverVersion)) return null;

  const driver = toVersion(driverVersion);
  const metCudaVersions = minimumDrivers.filter(({ minimumDriver }) => compareVersions(driver, minimumDriver) >= 0).map(({ cudaVersion }) => cudaVersion);

  return metCudaVersions.reduce<string | null>(
    (newest, cudaVersion) => (!newest || compareVersions(toVersion(cudaVersion), toVersion(newest)) > 0 ? cudaVersion : newest),
    null
  );
}

/** Reads NVIDIA's apt repository listing, where each `cuda-compat-X-Y` package is versioned with the driver it ships for CUDA X.Y. */
export function parseCudaCompatListing(listing: string): CudaMinimumDriver[] {
  const listed = [...listing.matchAll(CUDA_COMPAT_PACKAGE)].map(([, major, minor, driverVersion]) => ({
    cudaVersion: `${major}.${minor}`,
    minimumDriver: toVersion(driverVersion)
  }));

  return mergeCudaMinimumDrivers(listed);
}

export function mergeCudaMinimumDrivers(...tables: CudaMinimumDriver[][]): CudaMinimumDriver[] {
  const lowestByCudaVersion = new Map<string, CudaMinimumDriver>();

  for (const entry of tables.flat()) {
    const lowest = lowestByCudaVersion.get(entry.cudaVersion);
    if (!lowest || compareVersions(entry.minimumDriver, lowest.minimumDriver) < 0) lowestByCudaVersion.set(entry.cudaVersion, entry);
  }

  return [...lowestByCudaVersion.values()];
}

function toVersion(version: string): number[] {
  return version.split(".").map(Number);
}

function compareVersions(left: number[], right: number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}
