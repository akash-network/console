import { describe, expect, it } from "vitest";

import { BUNDLED_CUDA_MINIMUM_DRIVERS, getMaxCudaVersion, mergeCudaMinimumDrivers, parseCudaCompatListing } from "./cuda-version";

describe(getMaxCudaVersion.name, () => {
  it.each([
    ["550.54.14", "12.4"],
    ["535.54.03", "12.2"],
    ["570.26", "12.8"]
  ])("reads driver %s, the minimum of its toolkit, as CUDA %s", (driverVersion, cudaVersion) => {
    expect(getMaxCudaVersion(driverVersion, BUNDLED_CUDA_MINIMUM_DRIVERS)).toBe(cudaVersion);
  });

  it.each([
    ["550.54.13", "12.3"],
    ["570.25.99", "12.6"],
    ["525.60.12", "11.8"]
  ])("keeps driver %s, just short of the next toolkit's minimum, on CUDA %s", (driverVersion, cudaVersion) => {
    expect(getMaxCudaVersion(driverVersion, BUNDLED_CUDA_MINIMUM_DRIVERS)).toBe(cudaVersion);
  });

  it.each([
    ["550.127.05", "12.4"],
    ["535.230.02", "12.2"],
    ["565.57.01", "12.6"]
  ])("reads the later driver %s of a branch as CUDA %s", (driverVersion, cudaVersion) => {
    expect(getMaxCudaVersion(driverVersion, BUNDLED_CUDA_MINIMUM_DRIVERS)).toBe(cudaVersion);
  });

  it.each([
    ["580.95.05", "13.0"],
    ["590.44.01", "13.1"],
    ["595.12", "13.2"],
    ["610.1.2", "13.3"],
    ["615.20.01", "13.4"]
  ])("reads the 13.x driver %s by its branch as CUDA %s", (driverVersion, cudaVersion) => {
    expect(getMaxCudaVersion(driverVersion, BUNDLED_CUDA_MINIMUM_DRIVERS)).toBe(cudaVersion);
  });

  it("reads a driver newer than every known toolkit as the newest one it knows", () => {
    expect(getMaxCudaVersion("650.10.01", BUNDLED_CUDA_MINIMUM_DRIVERS)).toBe("13.4");
  });

  it("answers null for a driver older than every known toolkit", () => {
    expect(getMaxCudaVersion("440.33.01", BUNDLED_CUDA_MINIMUM_DRIVERS)).toBeNull();
  });

  it.each([[""], ["N/A"], ["550.x"], ["550..14"], ["-550.54.14"], ["5500.54.14"], ["550"], ["550.54.15-custom"]])(
    "answers null for the unparseable driver version %j",
    driverVersion => {
      expect(getMaxCudaVersion(driverVersion, BUNDLED_CUDA_MINIMUM_DRIVERS)).toBeNull();
    }
  );

  it("reads a table given in any order", () => {
    const minimumDrivers = [
      { cudaVersion: "12.4", minimumDriver: [550, 54, 14] },
      { cudaVersion: "13.0", minimumDriver: [580] },
      { cudaVersion: "12.8", minimumDriver: [570, 26] }
    ];

    expect(getMaxCudaVersion("575.51.03", minimumDrivers)).toBe("12.8");
  });

  it.each([
    [[{ cudaVersion: "13.4", minimumDriver: [615] }, { cudaVersion: "13.5", minimumDriver: [615] }]],
    [[{ cudaVersion: "13.5", minimumDriver: [615] }, { cudaVersion: "13.4", minimumDriver: [615] }]]
  ])("reads the newer of two cuda versions that share a minimum driver", minimumDrivers => {
    expect(getMaxCudaVersion("615.20.01", minimumDrivers)).toBe("13.5");
  });

  it("orders cuda versions by number rather than by text", () => {
    const minimumDrivers = [
      { cudaVersion: "12.10", minimumDriver: [600] },
      { cudaVersion: "12.9", minimumDriver: [600] }
    ];

    expect(getMaxCudaVersion("600.10.01", minimumDrivers)).toBe("12.10");
  });
});

describe(parseCudaCompatListing.name, () => {
  it("reads each cuda version's lowest listed compat driver from the repository listing", () => {
    const listing = [
      "<a href='cuda-compat-12-8_570.124.06-0ubuntu1_amd64.deb'>cuda-compat-12-8_570.124.06-0ubuntu1_amd64.deb</a>",
      "<a href='cuda-compat-12-8_570.86.10-0ubuntu1_amd64.deb'>cuda-compat-12-8_570.86.10-0ubuntu1_amd64.deb</a>",
      "<a href='cuda-compat-13-4_615.71.09-1ubuntu1_amd64.deb'>cuda-compat-13-4_615.71.09-1ubuntu1_amd64.deb</a>",
      "<a href='cuda-compat-13-4_615.71.09-2ubuntu1_amd64.deb'>cuda-compat-13-4_615.71.09-2ubuntu1_amd64.deb</a>",
      "<a href='cuda-compat-13-5_620.10.01-1ubuntu1_amd64.deb'>cuda-compat-13-5_620.10.01-1ubuntu1_amd64.deb</a>"
    ].join("\n");

    const minimumDrivers = parseCudaCompatListing(listing);

    expect(minimumDrivers).toHaveLength(3);
    expect(minimumDrivers).toEqual(
      expect.arrayContaining([
        { cudaVersion: "12.8", minimumDriver: [570, 86, 10] },
        { cudaVersion: "13.4", minimumDriver: [615, 71, 9] },
        { cudaVersion: "13.5", minimumDriver: [620, 10, 1] }
      ])
    );
  });

  it("ignores packages other than the compat drivers", () => {
    const listing = [
      "<a href='cuda-cudart-13-4_13.4.37-1_amd64.deb'>cuda-cudart-13-4_13.4.37-1_amd64.deb</a>",
      "<a href='cuda-compat-13-4-dev_615.71.09-1_amd64.deb'>cuda-compat-13-4-dev_615.71.09-1_amd64.deb</a>",
      "<a href='nvidia-driver-615_615.71.09-1ubuntu1_amd64.deb'>nvidia-driver-615_615.71.09-1ubuntu1_amd64.deb</a>"
    ].join("\n");

    expect(parseCudaCompatListing(listing)).toEqual([]);
  });
});

describe(mergeCudaMinimumDrivers.name, () => {
  it("keeps the lower minimum driver of a cuda version both tables list and adds the versions only one lists", () => {
    const bundled = [
      { cudaVersion: "12.4", minimumDriver: [550, 54, 14] },
      { cudaVersion: "13.4", minimumDriver: [615] }
    ];
    const listed = [
      { cudaVersion: "12.4", minimumDriver: [550, 90, 7] },
      { cudaVersion: "12.7", minimumDriver: [565, 57, 1] },
      { cudaVersion: "13.5", minimumDriver: [620, 10, 1] }
    ];

    const merged = mergeCudaMinimumDrivers(bundled, listed);

    expect(merged).toHaveLength(4);
    expect(merged).toEqual(
      expect.arrayContaining([
        { cudaVersion: "12.4", minimumDriver: [550, 54, 14] },
        { cudaVersion: "12.7", minimumDriver: [565, 57, 1] },
        { cudaVersion: "13.4", minimumDriver: [615] },
        { cudaVersion: "13.5", minimumDriver: [620, 10, 1] }
      ])
    );
  });
});
