import { describe, expect, it } from "vitest";

import { gpuAlertKeepUrl, gpuAlertLeaveUrl, gpuSetupDeployUrl, gpuSetupLabel } from "./gpu-setup-links";

const BASE = "https://console.akash.network";

describe("gpu setup links", () => {
  it("links a full setup to the configure page", () => {
    expect(gpuSetupDeployUrl(BASE, { vendor: "nvidia", model: "H100", gpuCount: 8, memory: "80Gi", interface: "SXM5" })).toBe(
      `${BASE}/new-deployment/configure?gpuVendor=nvidia&gpuModel=h100&gpuCount=8&gpuMemory=80Gi&gpuInterface=sxm5`
    );
  });

  it("leaves memory and interface out when the setup has none", () => {
    expect(gpuSetupDeployUrl(BASE, { vendor: "nvidia", model: "h100", gpuCount: 8, memory: null, interface: undefined })).toBe(
      `${BASE}/new-deployment/configure?gpuVendor=nvidia&gpuModel=h100&gpuCount=8`
    );
  });

  it("builds the leave and keep links for an alert", () => {
    expect(gpuAlertLeaveUrl(BASE, "entry-1")).toBe(`${BASE}/gpu-requests?leaveAlert=entry-1`);
    expect(gpuAlertKeepUrl(BASE, "entry-1")).toBe(`${BASE}/gpu-requests?keepAlert=entry-1`);
  });

  it("scopes every link to the entry's organization when it has one", () => {
    const setup = { vendor: "nvidia", model: "h100", gpuCount: 8 };

    expect(gpuSetupDeployUrl(BASE, setup, "org-1")).toBe(`${BASE}/new-deployment/configure?gpuVendor=nvidia&gpuModel=h100&gpuCount=8&org=org-1`);
    expect(gpuAlertLeaveUrl(BASE, "entry-1", "org-1")).toBe(`${BASE}/gpu-requests?leaveAlert=entry-1&org=org-1`);
    expect(gpuAlertKeepUrl(BASE, "entry-1", "org-1")).toBe(`${BASE}/gpu-requests?keepAlert=entry-1&org=org-1`);
  });

  it("labels a setup with its count, model, memory and interface", () => {
    expect(gpuSetupLabel({ vendor: "nvidia", model: "h100", gpuCount: 8, memory: "80Gi", interface: "sxm5" })).toBe("8× H100 80Gi SXM5");
    expect(gpuSetupLabel({ vendor: "nvidia", model: "a100", gpuCount: 1 })).toBe("1× A100");
  });
});
