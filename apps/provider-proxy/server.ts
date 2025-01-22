import http from "http";
import { v4 as uuidv4 } from "uuid";
import WebSocket from "ws";

import { app } from "./src/app";
import { ClientWebSocketStats, WebSocketUsage } from "./src/ClientSocketStats";
import { container } from "./src/container";

const { PORT = 3040 } = process.env;

const httpServer = app.listen(PORT, () => {
  console.log(`Http server listening on port ${PORT}`);
});

function getWebSocketUsage(message: any): WebSocketUsage {
  if (message.type === "websocket") {
    if (message.url.includes("logs?follow=false&tail=10000000")) return "DownloadLogs";
    if (message.url.includes("logs?follow=true")) return "StreamLogs";
    if (message.url.includes("kubeevents?follow=true")) return "StreamEvents";
    if (message.url.includes("/shell?stdin=")) return "Shell";
  }

  return "Unknown";
}

// Creating WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
  const id = uuidv4();

  const stats = new ClientWebSocketStats(id);
  container.wsStats.add(stats);

  console.log("Connection", req.url);
  ws.on("message", async (messageStr: string) => {
    const message = JSON.parse(messageStr);
    console.log("Received message: ", {
      ...message,
      certPem: "***REDACTED***",
      keyPem: "***REDACTED***"
    });

    stats.setUsage(getWebSocketUsage(message));

    try {
      // Handle ping
      if (message.type === "ping") {
        ws.send(
          JSON.stringify({
            type: "pong"
          })
        );
      } else if (message.type === "websocket") {
        const url = message.url.replace("https://", "wss://");

        if (openSocket[id]?.url === url) {
          const data = Buffer.from(message.data.split(","));
          // console.log(`Sending data to websocket: ${message.data}`);

          openSocket[id].send(data, err => {
            console.log(`error: ${err}`);
          });
        } else {
          openSocket[id]?.terminate();
          providerWebSocket(
            id,
            url,
            message.certPem,
            message.keyPem,
            socketMessage => {
              if (socketMessage) {
                const data = JSON.stringify({
                  type: "websocket",
                  message: socketMessage
                });
                stats.logDataTransfer(Buffer.from(data).length);
                ws.send(data);
              }
            },
            error => {
              const data = JSON.stringify({
                type: "websocket",
                message: error,
                error
              });
              stats.logDataTransfer(Buffer.from(data).length);
              ws.send(data);
            },
            () => {
              const data = JSON.stringify({
                type: "websocket",
                message: "",
                closed: true
              });
              stats.logDataTransfer(Buffer.from(data).length);
              ws.send(data);
            }
          );
        }
      } else {
        throw "Invalid message type: " + message.type;
      }
    } catch (err: any) {
      console.error("Sending error: " + err);
      ws.send(
        JSON.stringify({
          id: message.id,
          error: err.message || err,
          type: message.type
        })
      );
    }
  });

  ws.on("close", () => {
    console.log("Closing socket: " + id);

    stats.close();

    if (id in openSocket) {
      openSocket[id].terminate();
      delete openSocket[id];
    } else {
      console.log("Socket not found: " + id);
    }
  });
});

httpServer.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, socket => {
    wss.emit("connection", socket, request);
  });
});

const openSocket: { [key: string]: WebSocket } = {};

process.on("uncaughtException", error => {
  console.error(error);
});

function providerWebSocket(
  id: string,
  url: string,
  certPem: string,
  keyPem: string,
  onMessage: (data: any) => void,
  onError: (data: any) => void,
  onClose: () => void
) {
  console.log(`New websocket: ${url}`);

  const ws = new WebSocket(url, {
    cert: certPem,
    key: keyPem,
    rejectUnauthorized: false
  });

  openSocket[id] = ws;

  ws.on("open", function open() {
    console.log("connected");
  });

  ws.on("message", function incoming(data: any) {
    onMessage(data);
  });

  ws.on("error", event => {
    console.error("Websocket received an error", event);
    onError(event);
  });

  ws.on("close", event => {
    console.info("Websocket was closed", event);
    onClose();
  });
}
