import { describe, expect, it } from "vitest";

import { getMaxCudaVersion } from "./cuda-version";

describe(getMaxCudaVersion.name, () => {
  it.each([
    ["550.54.14", "12.4"],
    ["535.54.03", "12.2"],
    ["570.26", "12.8"]
  ])("reads driver %s, the minimum of its toolkit, as CUDA %s", (driverVersion, cudaVersion) => {
    expect(getMaxCudaVersion(driverVersion)).toBe(cudaVersion);
  });

  it.each([
    ["550.54.13", "12.3"],
    ["570.25.99", "12.6"],
    ["525.60.12", "11.8"]
  ])("keeps driver %s, just short of the next toolkit's minimum, on CUDA %s", (driverVersion, cudaVersion) => {
    expect(getMaxCudaVersion(driverVersion)).toBe(cudaVersion);
  });

  it.each([
    ["550.127.05", "12.4"],
    ["535.230.02", "12.2"],
    ["565.57.01", "12.6"]
  ])("reads the later driver %s of a branch as CUDA %s", (driverVersion, cudaVersion) => {
    expect(getMaxCudaVersion(driverVersion)).toBe(cudaVersion);
  });

  it.each([
    ["580.95.05", "13.0"],
    ["590.44.01", "13.1"],
    ["595.12", "13.2"],
    ["610.1.2", "13.3"],
    ["615.20.01", "13.4"]
  ])("reads the 13.x driver %s by its branch as CUDA %s", (driverVersion, cudaVersion) => {
    expect(getMaxCudaVersion(driverVersion)).toBe(cudaVersion);
  });

  it("reads a driver newer than every known toolkit as the newest one it knows", () => {
    expect(getMaxCudaVersion("650.10.01")).toBe("13.4");
  });

  it("answers null for a driver older than every known toolkit", () => {
    expect(getMaxCudaVersion("440.33.01")).toBeNull();
  });

  it.each([[""], ["N/A"], ["550.x"], ["550..14"], ["-550.54.14"]])("answers null for the unparseable driver version %j", driverVersion => {
    expect(getMaxCudaVersion(driverVersion)).toBeNull();
  });
});
