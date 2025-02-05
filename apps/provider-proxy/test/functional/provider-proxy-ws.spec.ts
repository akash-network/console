import { setTimeout } from "timers/promises";
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
    const providerServerUrl = await startProviderServer({
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

    ws.send(JSON.stringify(ourMessage("hello", providerServerUrl)));
    ws.send(JSON.stringify(ourMessage("test", providerServerUrl)));

    expect(await waitForMessage(ws)).toEqual(providerMessage("connected"));

    ws.send(JSON.stringify(ourMessage("flush", providerServerUrl)));
    expect(await waitForMessage(ws)).toEqual(providerMessage(JSON.stringify(["hello", "test", "flush"])));
  });

  it("does not connect to provider socket until 1st message is sent", async () => {
    const proxyServerUrl = await startServer();
    const providerServerUrl = await startProviderServer({
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

    ws.send(JSON.stringify(ourMessage("hello", providerServerUrl)));

    expect(await waitForMessage(ws)).toEqual(providerMessage("connected"));
  });

  it('does not send message to provider socket if "data" property is empty', async () => {
    const proxyServerUrl = await startServer();
    const providerServerUrl = await startProviderServer({
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
    ws.send(JSON.stringify(ourMessage("", providerServerUrl)));

    const receivedProviderMessage = await Promise.race([waitForMessage(ws), setTimeout(200, null)]);

    expect(receivedProviderMessage).toBe(null);
  });

  it("closes provider websocket when client websocket is closed", async () => {
    const proxyServerUrl = await startServer();
    const onProviderWsClose = jest.fn();
    const providerServerUrl = await startProviderServer({
      websocketServer: {
        enable: true,
        onConnection: pws => pws.on("close", onProviderWsClose)
      }
    });
    const ws = new WebSocket(`${proxyServerUrl}/ws`);

    await new Promise(resolve => ws.once("open", resolve));
    ws.send(JSON.stringify(ourMessage("hello", providerServerUrl)));
    await setTimeout(100);
    ws.close();
    await setTimeout(100);

    expect(onProviderWsClose).toHaveBeenCalled();
  });

  it("sends close message if provider socket has been closed", async () => {
    const proxyServerUrl = await startServer();
    const providerServerUrl = await startProviderServer({
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

    await new Promise(resolve => ws.once("open", resolve)), ws.send(JSON.stringify(ourMessage("please_close", providerServerUrl)));
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
    const providerServerUrl = await startProviderServer({
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
        ourMessage("test1", providerServerUrl, {
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
        ourMessage("test2", providerServerUrl, {
          providerAddress,
          chainNetwork: "sandbox"
        })
      )
    );
    expect(await waitForMessage(ws)).toEqual(providerMessage("connected"));
    expect(await waitForMessage(ws)).toEqual(providerMessage("replied: test2"));
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
      url: `${url}/test`
    };
  }

  function waitForMessage<T>(ws: WebSocket) {
    return new Promise<T>(resolve => {
      ws.once("message", data => resolve(JSON.parse(data.toString())));
    });
  }
});
