import { SupportedChainNetworks } from "@akashnetwork/net";
import { setTimeout } from "timers/promises";

import { createX509CertPair } from "../seeders/createX509CertPair";
import { generateBech32, startChainApiServer, stopChainAPIServer } from "../setup/chainApiServer";
import { startProviderServer, stopProviderServer } from "../setup/providerServer";
import { request } from "../setup/proxyServer";
import { startServer, stopServer } from "../setup/proxyServer";

describe("Provider HTTP proxy", () => {
  const network: SupportedChainNetworks = "sandbox";
  const ONE_HOUR = 60 * 60 * 1000;

  beforeAll(async () => {
    await startServer();
  });

  afterAll(() => {
    stopServer();
  });

  afterEach(() => {
    stopProviderServer();
    stopChainAPIServer();
  });

  it("proxies request if provider uses self-signed certificate which is available on chain", async () => {
    const providerAddress = generateBech32();
    const validCertPair = createX509CertPair({ commonName: providerAddress, validFrom: new Date(Date.now() - ONE_HOUR) });

    await startChainApiServer([validCertPair.cert]);
    const providerUrl = await startProviderServer({ certPair: validCertPair });

    const response = await request("/", {
      method: "POST",
      body: JSON.stringify({
        method: "GET",
        url: `${providerUrl}/200.txt`,
        providerAddress,
        network
      })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain");

    const body = await response.text();
    expect(body).toBe("Hello, World!");
  });

  it("proxies headers from remote provider host", async () => {
    const providerAddress = generateBech32();
    const validCertPair = createX509CertPair({ commonName: providerAddress, validFrom: new Date(Date.now() - ONE_HOUR) });

    await startChainApiServer([validCertPair.cert]);
    const providerUrl = await startProviderServer({ certPair: validCertPair });

    const response = await request("/", {
      method: "POST",
      body: JSON.stringify({
        method: "GET",
        url: `${providerUrl}/headers.json`,
        providerAddress,
        network
      })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("x-custom-header")).toBe("test");

    const body = await response.text();
    expect(body).toBe(JSON.stringify({ ok: true }));
  });

  it("can work without chain API by using cached certificates", async () => {
    const providerAddress = generateBech32();
    const validCertPair = createX509CertPair({ commonName: providerAddress, validFrom: new Date(Date.now() - ONE_HOUR) });

    const chainServer = await startChainApiServer([validCertPair.cert]);
    const providerUrl = await startProviderServer({ certPair: validCertPair });

    let response = await request("/", {
      method: "POST",
      body: JSON.stringify({
        method: "GET",
        url: `${providerUrl}/200.txt`,
        providerAddress,
        network
      })
    });
    chainServer.close();

    response = await request("/", {
      method: "POST",
      body: JSON.stringify({
        method: "GET",
        url: `${providerUrl}/200.txt`,
        providerAddress,
        network
      })
    });

    expect(response.status).toBe(200);

    const body = await response.text();
    expect(body).toBe("Hello, World!");
  });

  it("responds with 495 error if certificate is not on chain", async () => {
    const providerAddress = generateBech32();
    const validCertPair = createX509CertPair({ commonName: providerAddress, validFrom: new Date(Date.now() - ONE_HOUR) });

    await startChainApiServer([
      createX509CertPair({
        commonName: providerAddress,
        validFrom: new Date(Date.now() + ONE_HOUR),
        serialNumber: Date.now().toString()
      }).cert
    ]);
    const providerUrl = await startProviderServer({ certPair: validCertPair });
    const requestProvider = () =>
      request("/", {
        method: "POST",
        body: JSON.stringify({
          method: "GET",
          url: `${providerUrl}/200.txt`,
          providerAddress,
          network
        })
      });

    let response = await requestProvider();
    expect(response.status).toBe(495);

    let body = await response.text();
    expect(body).toContain("unknownCertificate");

    response = await requestProvider();
    expect(response.status).toBe(495);

    body = await response.text();
    expect(body).toContain("unknownCertificate");
  });

  it("responds with 495 error if server uses invalid certificate", async () => {
    const providerAddress = generateBech32();
    const validCertPair = createX509CertPair({
      commonName: providerAddress,
      validFrom: new Date(Date.now() - 24 * ONE_HOUR),
      validTo: new Date(Date.now() - ONE_HOUR)
    });

    await startChainApiServer([createX509CertPair({ commonName: providerAddress, validFrom: new Date(Date.now() + ONE_HOUR) }).cert, validCertPair.cert]);
    const providerUrl = await startProviderServer({ certPair: validCertPair });

    const requestProvider = () =>
      request("/", {
        method: "POST",
        body: JSON.stringify({
          method: "GET",
          url: `${providerUrl}/200.txt`,
          providerAddress,
          network
        })
      });

    let response = await requestProvider();

    expect(response.status).toBe(495);

    let body = await response.text();
    expect(body).toContain("expired");

    response = await requestProvider();
    expect(response.status).toBe(495);

    body = await response.text();
    expect(body).toContain("expired");
  });

  it("retries fetching chain certificates if chain API is unavailable", async () => {
    const providerAddress = generateBech32();
    const validCertPair = createX509CertPair({
      commonName: providerAddress
    });

    const providerUrl = await startProviderServer({ certPair: validCertPair });

    process.env.TEST_CHAIN_NETWORK_URL = "http://localhost:31234";
    const responsePromise = request("/", {
      method: "POST",
      body: JSON.stringify({
        method: "GET",
        url: `${providerUrl}/200.txt`,
        providerAddress,
        network
      })
    });
    await setTimeout(200);
    await startChainApiServer([validCertPair.cert]);
    const response = await responsePromise;

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe("Hello, World!");
  });

  it("retries if chain API responds with 5xx request", async () => {
    const providerAddress = generateBech32();
    const validCertPair = createX509CertPair({
      commonName: providerAddress
    });

    const providerUrl = await startProviderServer({ certPair: validCertPair });
    await startChainApiServer([validCertPair.cert], {
      respondOnceWith: 502
    });

    const response = await request("/", {
      method: "POST",
      body: JSON.stringify({
        method: "GET",
        url: `${providerUrl}/200.txt`,
        providerAddress,
        network
      })
    });

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe("Hello, World!");
  });

  it("retries on provider host returning 5xx", async () => {
    const providerAddress = generateBech32();
    const validCertPair = createX509CertPair({
      commonName: providerAddress
    });

    const providerUrl = await startProviderServer({ certPair: validCertPair });
    await startChainApiServer([validCertPair.cert]);

    const response = await request("/", {
      method: "POST",
      body: JSON.stringify({
        method: "GET",
        url: `${providerUrl}/5xx-once`,
        providerAddress,
        network
      })
    });

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe("Success");
  });

  it("retries on provider host being slow", async () => {
    const providerAddress = generateBech32();
    const validCertPair = createX509CertPair({
      commonName: providerAddress
    });

    const providerUrl = await startProviderServer({ certPair: validCertPair });
    await startChainApiServer([validCertPair.cert]);

    const response = await request("/", {
      method: "POST",
      body: JSON.stringify({
        method: "GET",
        url: `${providerUrl}/slow-once`,
        providerAddress,
        network,
        timeout: 200
      })
    });

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe("Fast");
  });
});
