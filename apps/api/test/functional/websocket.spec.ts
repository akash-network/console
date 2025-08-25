import { setTimeout as delay } from "timers/promises";
import waitForExpect from "wait-for-expect";
import WebSocket from "ws";

import { createAkashAddress } from "@test/seeders";
import { createX509CertPair } from "@test/seeders/x509-cert-pair";
import { startProviderServer, stopProviderServer } from "@test/setup/provider-server";
import { startServer } from "@test/setup/server";
import { setupUser, teardownUser } from "@test/setup/setup-user";

jest.setTimeout(20000);

describe("Provider WebSocket", () => {
  afterEach(() => {
    stopProviderServer();
    teardownUser();
  });

  it("proxies provider websocket messages", async () => {
    const { providerAddress, providerUrl, ws } = await setup({
      onConnection: providerWs => {
        providerWs.send("connected");
        const messages: string[] = [];
        providerWs.on("message", (data: Buffer) => {
          messages.push(data.toString());
          console.log("messages", messages);
          if (data.toString() === "flush") {
            providerWs.send(JSON.stringify(messages));
          }
        });
      }
    });

    await new Promise(resolve => ws.once("open", resolve));
    ws.send(JSON.stringify(ourMessage("hello", providerUrl, { providerAddress })));
    expect(await waitForMessage(ws)).toEqual(providerMessage("connected"));

    ws.send(JSON.stringify(ourMessage("test", providerUrl, { providerAddress })));
    ws.send(JSON.stringify(ourMessage("flush", providerUrl, { providerAddress })));
    expect(await waitForMessage(ws)).toEqual(providerMessage(JSON.stringify(["hello", "test", "flush"])));
  });

  it("responds to ping messages", async () => {
    const { ws } = await setup({
      onConnection: providerWs => {
        providerWs.on("message", (data: Buffer) => {
          if (data.toString() === "ping") {
            providerWs.send("pong");
          }
        });
      }
    });

    await new Promise(resolve => ws.once("open", resolve));
    ws.send(JSON.stringify({ type: "ping" }));

    expect(await waitForMessage(ws)).toEqual({ type: "pong" });
  });

  it("does not connect to provider socket until 1st message is sent", async () => {
    const { ws, providerAddress, providerUrl } = await setup({
      onConnection: providerWs => providerWs.send("connected")
    });

    const [providerMessageOnConnect] = await Promise.all([
      Promise.race([waitForMessage(ws), delay(200, null)]),
      new Promise(resolve => ws.once("open", resolve))
    ]);
    expect(providerMessageOnConnect).toBe(null);

    ws.send(JSON.stringify(ourMessage("hello", providerUrl, { providerAddress })));

    expect(await waitForMessage(ws)).toEqual(providerMessage("connected"));
  });

  it('does not send message to provider socket if "data" property is empty', async () => {
    const { ws, providerAddress, providerUrl } = await setup({
      onConnection: providerWs =>
        providerWs.on("message", () => {
          providerWs.send("received");
        })
    });

    await new Promise(resolve => ws.once("open", resolve));
    ws.send(JSON.stringify(ourMessage("", providerUrl, { providerAddress })));

    const receivedProviderMessage = await Promise.race([waitForMessage(ws), delay(200, null)]);

    expect(receivedProviderMessage).toBe(null);
  });

  it("closes provider websocket when client websocket is closed", async () => {
    let isProviderWebsocketOpen = false;
    const onProviderWsClose = jest.fn();
    const { ws, providerAddress, providerUrl } = await setup({
      onConnection: providerWs => {
        isProviderWebsocketOpen = true;
        providerWs.on("close", onProviderWsClose);
      }
    });

    await new Promise(resolve => ws.once("open", resolve));
    ws.send(JSON.stringify(ourMessage("hello", providerUrl, { providerAddress })));
    await waitForExpect(() => {
      expect(isProviderWebsocketOpen).toBe(true);
    }, 5000);

    ws.close();

    await waitForExpect(() => {
      expect(onProviderWsClose).toHaveBeenCalled();
    });
  });

  it("sends close message if provider socket has been closed", async () => {
    const { ws, providerAddress, providerUrl } = await setup({
      onConnection: providerWs =>
        providerWs.on("message", data => {
          if (data.toString() === "please_close") {
            providerWs.close(1000);
          }
        })
    });

    await new Promise(resolve => ws.once("open", resolve));
    ws.send(JSON.stringify(ourMessage("please_close", providerUrl, { providerAddress })));

    expect(await waitForMessage(ws)).toEqual(
      providerMessage("", {
        closed: true,
        code: 1000,
        reason: ""
      })
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
      providerAddress: extra?.providerAddress || createAkashAddress(),
      chainNetwork: extra?.chainNetwork || "sandbox"
    };
  }

  function waitForMessage<T>(ws: WebSocket) {
    return new Promise<T>(resolve => {
      ws.once("message", data => resolve(JSON.parse(data.toString())));
    });
  }

  type SetupOptions = {
    onConnection?: (providerWs: WebSocket) => void;
  };

  async function setup(options: SetupOptions) {
    const { apiKey } = await setupUser();

    const serverUrl = await startServer();
    const providerAddress = createAkashAddress();
    const certPair = createX509CertPair({ commonName: providerAddress });
    const { providerUrl } = await startProviderServer({
      certPair,
      websocketServer: {
        enable: true,
        onConnection: options.onConnection
      }
    });
    const ws = new WebSocket(`${serverUrl}/v1/ws`, {
      headers: {
        "x-api-key": apiKey
      }
    });

    return {
      providerAddress,
      providerUrl,
      ws
    };
  }
});
