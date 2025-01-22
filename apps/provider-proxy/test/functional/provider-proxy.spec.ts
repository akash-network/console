import { request } from "../setup/apiClient";

describe("Provider proxy", () => {
  it("should proxy request if provider uses self-signed certificate", async () => {
    const response = await request("/", {
      method: "POST",
      body: JSON.stringify({
        method: "GET",
        url: "https://provider.tevuicdasialmareny.es:8443/status"
      })
    });

    const body = await response.json();
    expect(body.cluster_public_hostname).toBe("provider.tevuicdasialmareny.es");
  });

  it("should proxy request if provider uses trusted CA issued certificate", async () => {
    const response = await request("/", {
      method: "POST",
      body: JSON.stringify({
        method: "GET",
        url: "https://api.cloudmos.io/internal/gpu-prices"
      })
    });

    const body = await response.json();
    expect(body.availability).toBeTruthy();
  });
});
