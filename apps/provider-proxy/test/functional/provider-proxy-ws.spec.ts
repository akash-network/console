import { createSignArbitraryAkashWallet, JwtTokenManager } from "@akashnetwork/chain-sdk";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { setTimeout } from "timers/promises";
import type { TLSSocket } from "tls";
import WebSocket from "ws";

import { createX509CertPair } from "../seeders/createX509CertPair";
import { generateBech32, startChainApiServer, stopChainAPIServer } from "../setup/chainApiServer";
import { startProviderServer, stopProviderServer } from "../setup/providerServer";
import { startServer, stopServer } from "../setup/proxyServer";

describe("Provider proxy ws", () => {
  afterEach(() => {
    stopProviderServer();
    stopServer();
    stopChainAPIServer();
  });

  it("proxies provider websocket messages", async () => {
    const proxyServerUrl = await startServer();
    const providerAddress = generateBech32();
    const certPair = createX509CertPair({ commonName: providerAddress });
    await startChainApiServer([certPair.cert]);
    const { providerUrl } = await startProviderServer({
      certPair,
      websocketServer: {
        enable: true,
        onConnection(pws) {
          pws.send("connected");
          const messages: string[] = [];
          pws.on("message", (data: Buffer) => {
            messages.push(data.toString());
            if (data.toString() === "flush") {
              pws.send(JSON.stringify(messages));
            }
          });
        }
      }
    });
    const ws = new WebSocket(`${proxyServerUrl}/ws`);

    await new Promise(resolve => ws.once("open", resolve));

    ws.send(JSON.stringify(ourMessage("hello", providerUrl, { providerAddress })));
    ws.send(JSON.stringify(ourMessage("test", providerUrl, { providerAddress })));

    expect(await waitForMessage(ws)).toEqual(providerMessage("connected"));

    ws.send(JSON.stringify(ourMessage("flush", providerUrl, { providerAddress })));
    expect(await waitForMessage(ws)).toEqual(providerMessage(JSON.stringify(["hello", "test", "flush"])));
  });

  it("responds to ping messages", async () => {
    const proxyServerUrl = await startServer();
    const providerAddress = generateBech32();
    const certPair = createX509CertPair({ commonName: providerAddress });
    await startChainApiServer([certPair.cert]);
    await startProviderServer({
      certPair,
      websocketServer: {
        enable: true,
        onConnection: pws => {
          pws.on("message", (data: Buffer) => {
            if (data.toString() === "ping") {
              pws.send("pong");
            }
          });
        }
      }
    });
    const ws = new WebSocket(`${proxyServerUrl}/ws`);

    await new Promise(resolve => ws.once("open", resolve));
    ws.send(JSON.stringify({ type: "ping" }));

    expect(await waitForMessage(ws)).toEqual({ type: "pong" });
  });

  it("does not connect to provider socket until 1st message is sent", async () => {
    const proxyServerUrl = await startServer();
    const providerAddress = generateBech32();
    const certPair = createX509CertPair({ commonName: providerAddress });
    await startChainApiServer([certPair.cert]);
    const { providerUrl } = await startProviderServer({
      certPair,
      websocketServer: {
        enable: true,
        onConnection: pws => pws.send("connected")
      }
    });
    const ws = new WebSocket(`${proxyServerUrl}/ws`);

    const [providerMessageOnConnect] = await Promise.all([
      Promise.race([waitForMessage(ws), setTimeout(200, null)]),
      new Promise(resolve => ws.once("open", resolve))
    ]);
    expect(providerMessageOnConnect).toBe(null);

    ws.send(JSON.stringify(ourMessage("hello", providerUrl, { providerAddress })));

    expect(await waitForMessage(ws)).toEqual(providerMessage("connected"));
  });

  it('does not send message to provider socket if "data" property is empty', async () => {
    const proxyServerUrl = await startServer();
    const providerAddress = generateBech32();
    const certPair = createX509CertPair({ commonName: providerAddress });
    await startChainApiServer([certPair.cert]);
    const { providerUrl } = await startProviderServer({
      certPair,
      websocketServer: {
        enable: true,
        onConnection: pws =>
          pws.on("message", () => {
            pws.send("received");
          })
      }
    });
    const ws = new WebSocket(`${proxyServerUrl}/ws`);

    await new Promise(resolve => ws.once("open", resolve));
    ws.send(JSON.stringify(ourMessage("", providerUrl, { providerAddress })));

    const receivedProviderMessage = await Promise.race([waitForMessage(ws), setTimeout(200, null)]);

    expect(receivedProviderMessage).toBe(null);
  });

  it("closes provider websocket when client websocket is closed", async () => {
    const proxyServerUrl = await startServer();
    const onProviderWsClose = jest.fn();
    const providerAddress = generateBech32();
    const certPair = createX509CertPair({ commonName: providerAddress });
    await startChainApiServer([certPair.cert]);
    const { providerUrl } = await startProviderServer({
      certPair,
      websocketServer: {
        enable: true,
        onConnection: pws => pws.on("close", onProviderWsClose)
      }
    });
    const ws = new WebSocket(`${proxyServerUrl}/ws`);

    await new Promise(resolve => ws.once("open", resolve));
    ws.send(JSON.stringify(ourMessage("hello", providerUrl, { providerAddress })));
    await setTimeout(100);
    ws.close();
    await setTimeout(100);

    expect(onProviderWsClose).toHaveBeenCalled();
  });

  it("sends close message if provider socket has been closed", async () => {
    const proxyServerUrl = await startServer();
    const providerAddress = generateBech32();
    const certPair = createX509CertPair({ commonName: providerAddress });
    await startChainApiServer([certPair.cert]);
    const { providerUrl } = await startProviderServer({
      certPair,
      websocketServer: {
        enable: true,
        onConnection: pws =>
          pws.on("message", data => {
            if (data.toString() === "please_close") {
              pws.close(1000);
            }
          })
      }
    });
    const ws = new WebSocket(`${proxyServerUrl}/ws`);

    await new Promise(resolve => ws.once("open", resolve)), ws.send(JSON.stringify(ourMessage("please_close", providerUrl, { providerAddress })));
    expect(await waitForMessage(ws)).toEqual(
      providerMessage("", {
        closed: true,
        code: 1000,
        reason: ""
      })
    );
  });

  it('validates server certificate if "chainNetwork" and "providerAddress" are provided', async () => {
    const providerAddress = generateBech32();
    const validCertPair = createX509CertPair({ commonName: providerAddress });
    await startChainApiServer([validCertPair.cert]);
    const { providerUrl } = await startProviderServer({
      certPair: validCertPair,
      websocketServer: {
        enable: true,
        onConnection: pws => {
          pws.send("connected");
          pws.on("message", data => pws.send(`replied: ${data.toString()}`));
        }
      }
    });
    const proxyServerUrl = await startServer();

    const ws = new WebSocket(`${proxyServerUrl}/ws`);
    await new Promise(resolve => ws.once("open", resolve));

    ws.send(
      JSON.stringify(
        ourMessage("test1", providerUrl, {
          providerAddress: generateBech32(),
          chainNetwork: "sandbox"
        })
      )
    );

    expect(await waitForMessage(ws)).toEqual(
      providerMessage("", {
        closed: true,
        code: 1008,
        reason: "invalidCertificate.unknownCertificate"
      })
    );

    ws.send(
      JSON.stringify(
        ourMessage("test2", providerUrl, {
          providerAddress,
          chainNetwork: "sandbox"
        })
      )
    );
    expect(await waitForMessage(ws)).toEqual(providerMessage("connected"));
    expect(await waitForMessage(ws)).toEqual(providerMessage("replied: test2"));
  });

  it("supports mtls authentication", async () => {
    const proxyServerUrl = await startServer();
    const providerAddress = generateBech32();
    const certPair = createX509CertPair({ commonName: providerAddress });
    await startChainApiServer([certPair.cert]);
    const { providerUrl } = await startProviderServer({
      certPair,
      requireClientCertificate: true,
      websocketServer: {
        enable: true,
        onConnection(pws, req) {
          const clientCert = (req.socket as TLSSocket).getPeerCertificate();
          pws.send(`authenticated:${!!clientCert}`);
        }
      }
    });
    const ws = new WebSocket(`${proxyServerUrl}/ws`);

    await new Promise(resolve => ws.once("open", resolve));

    const clientCertPair = createX509CertPair({ commonName: generateBech32() });
    ws.send(
      JSON.stringify(
        ourMessage("hello", providerUrl, {
          providerAddress,
          auth: {
            type: "mtls",
            certPem: clientCertPair.cert.toString(),
            keyPem: clientCertPair.key
          }
        })
      )
    );

    expect(await waitForMessage(ws)).toEqual(providerMessage("authenticated:true"));

    ws.send(
      JSON.stringify(
        ourMessage("hello", providerUrl, {
          providerAddress,
          auth: {
            type: "mtls",
            certPem: "asdasdasd",
            keyPem: "asdasd"
          }
        })
      )
    );

    const response = (await waitForMessage(ws)) as { errors: any[] };
    expect(response.errors).toEqual(
      expect.arrayContaining([
        {
          code: "custom",
          message: "is not a valid certificate",
          path: ["auth", "certPem"],
          params: {
            reason: "invalid"
          }
        }
      ])
    );
  });

  it("supports jwt authentication", async () => {
    const proxyServerUrl = await startServer();
    const providerAddress = generateBech32();
    const certPair = createX509CertPair({ commonName: providerAddress });
    await startChainApiServer([certPair.cert]);
    const { providerUrl } = await startProviderServer({
      certPair,
      requireClientCertificate: true,
      websocketServer: {
        enable: true,
        onConnection(pws, req) {
          pws.send(`authenticated:${!!req.headers.authorization}`);
        }
      }
    });
    const ws = new WebSocket(`${proxyServerUrl}/ws`);

    await new Promise(resolve => ws.once("open", resolve));

    const testMnemonic =
      "monkey power feature blast stem fabric fiber lens spring crisp kingdom memory put differ wise jar same illegal elbow kiss pill hamster moment spare";
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(testMnemonic, { prefix: "akash" });
    const tokenManager = new JwtTokenManager(await createSignArbitraryAkashWallet(wallet));
    const token = await tokenManager.generateToken({
      iss: (await wallet.getAccounts())[0].address,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      version: "v1",
      leases: { access: "full" }
    });
    ws.send(
      JSON.stringify(
        ourMessage("hello", providerUrl, {
          providerAddress,
          auth: {
            type: "jwt",
            token
          }
        })
      )
    );

    expect(await waitForMessage(ws)).toEqual(providerMessage("authenticated:true"));

    ws.send(
      JSON.stringify(
        ourMessage("hello", providerUrl, {
          providerAddress,
          auth: {
            type: "jwt",
            token: "testst"
          }
        })
      )
    );

    const response = (await waitForMessage(ws)) as { errors: any[] };
    expect(response.errors).toEqual(
      expect.arrayContaining([
        {
          code: "custom",
          message: "is not a valid JWT token",
          path: ["auth", "token"],
          params: {
            errors: ["Invalid token"]
          }
        }
      ])
    );
  });

  function providerMessage<T>(message: T, extra?: Record<string, any>) {
    return {
      ...extra,
      type: "websocket",
      message
    };
  }

  function ourMessage(message: string, url: string, extra?: Record<string, any>) {
    return {
      ...extra,
      type: "websocket",
      data: message
        .split("")
        .map(char => char.charCodeAt(0))
        .join(","),
      url: `${url}/test`,
      providerAddress: extra?.providerAddress || generateBech32(),
      network: extra?.chainNetwork || "sandbox"
    };
  }

  function waitForMessage<T>(ws: WebSocket) {
    return new Promise<T>(resolve => {
      ws.once("message", data => resolve(JSON.parse(data.toString())));
    });
  }
});
