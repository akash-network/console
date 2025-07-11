import type { SupportedChainNetworks } from "@akashnetwork/net";
import { setTimeout as wait } from "timers/promises";

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

  afterAll(async () => {
    await stopServer();
  });

  afterEach(async () => {
    await Promise.all([stopProviderServer(), stopChainAPIServer()]);
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
    await wait(200);
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
    let isRespondedWith502 = false;
    await startChainApiServer([validCertPair.cert], {
      interceptRequest(_, res) {
        if (isRespondedWith502) return false;
        isRespondedWith502 = true;
        res.writeHead(502);
        res.end();
        return true;
      }
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

    let returned5xx = false;
    const providerUrl = await startProviderServer({
      certPair: validCertPair,
      handlers: {
        "/5xx-once"(_, res) {
          if (!returned5xx) {
            returned5xx = true;
            res.writeHead(502);
            res.end();
            return;
          }

          res.writeHead(200, "OK", { "Content-Type": "text/plain" });
          res.end("Success");
        }
      }
    });
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

    let wasSlow = false;
    const providerUrl = await startProviderServer({
      certPair: validCertPair,
      handlers: {
        "/slow-once"(_, res) {
          if (!wasSlow) {
            wasSlow = true;
            const timeout = setTimeout(() => {
              clearSlowTimer();
              res.writeHead(200);
              res.end("Slow");
            }, 1000);
            const clearSlowTimer = () => clearTimeout(timeout);
            return clearSlowTimer;
          }

          res.writeHead(200, "OK", { "Content-Type": "text/plain" });
          res.end("Fast");
        }
      }
    });
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

  it("responds with 503 if provider returns 500 error", async () => {
    const providerAddress = generateBech32();
    const validCertPair = createX509CertPair({
      commonName: providerAddress
    });

    const providerUrl = await startProviderServer({
      certPair: validCertPair,
      handlers: {
        "/500"(_, res) {
          res.writeHead(500);
          res.end("Internal Server Error");
        }
      }
    });
    await startChainApiServer([validCertPair.cert]);

    const response = await request("/", {
      method: "POST",
      body: JSON.stringify({
        method: "GET",
        url: `${providerUrl}/500`,
        providerAddress,
        network
      })
    });

    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toBe(`Provider ${providerUrl} is temporarily unavailable`);
  });

  it("responds with 503 if provider host is not reachable", async () => {
    const providerAddress = generateBech32();
    const validCertPair = createX509CertPair({
      commonName: providerAddress
    });

    await startChainApiServer([validCertPair.cert]);
    const providerUrl = `https://some-unknown-host-${Date.now()}.com/200`;

    const response = await request("/", {
      method: "POST",
      body: JSON.stringify({
        method: "GET",
        url: providerUrl,
        providerAddress,
        network
      })
    });

    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toBe(`Provider ${new URL(providerUrl).origin} is temporarily unavailable`);
  });

  it("responds with 503 if provider host hangs up connection", async () => {
    const providerAddress = generateBech32();
    const validCertPair = createX509CertPair({
      commonName: providerAddress
    });

    const providerUrl = await startProviderServer({
      certPair: validCertPair,
      handlers: {
        "/hangs-up"(req) {
          req.destroy();
        }
      }
    });
    await startChainApiServer([validCertPair.cert]);

    const response = await request("/", {
      method: "POST",
      body: JSON.stringify({
        method: "GET",
        url: `${providerUrl}/hangs-up`,
        providerAddress,
        network
      })
    });

    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toBe(`Provider ${providerUrl} is temporarily unavailable`);
  });
});
