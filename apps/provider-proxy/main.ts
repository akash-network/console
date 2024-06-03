import cors from "cors";
import express, { Express, Request, Response } from "express";
import http from "http";
import { Agent } from "https";
import fetch, { Headers } from "node-fetch";
import { v4 as uuidv4 } from "uuid";
import WebSocket from "ws";

import { ClientWebSocketStats, WebSocketUsage } from "./clientSocketStats";
import packageJson from "./package.json";
import { humanFileSize } from "./sizeUtils";

const app: Express = express();

const { PORT = 3040 } = process.env;

const webSocketStats: ClientWebSocketStats[] = [];

const whitelist = [
  "http://localhost:3001",
  "http://localhost:3000",
  "https://deploybeta.cloudmos.io",
  "https://deploy.cloudmos.io",
  "https://cloudmos.grafana.net",
  "https://console.akash.network",
  "https://beta.cloudmos.io",
  "https://staging-console.akash.network"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || whitelist.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("Cors refused: " + origin);
        callback(new Error("Not allowed by CORS"));
      }
    }
  })
);
app.use(express.json());

app.get("/status", async (req: Request, res: Response) => {
  const openClientWebSocketCount = webSocketStats.filter(x => !x.isClosed()).length;
  const totalRequestCount = webSocketStats.reduce((a, b) => a + b.getStats().totalStats.count, 0);
  const totalTransferred = webSocketStats.reduce((a, b) => a + b.getStats().totalStats.data, 0);

  const logStreaming = webSocketStats
    .map(s => s.getStats().usageStats["StreamLogs"])
    .reduce((a, b) => ({ count: a.count + b.count, data: a.data + b.data }), {
      count: 0,
      data: 0
    });
  const logDownload = webSocketStats
    .map(s => s.getStats().usageStats["DownloadLogs"])
    .reduce((a, b) => ({ count: a.count + b.count, data: a.data + b.data }), {
      count: 0,
      data: 0
    });
  const eventStreaming = webSocketStats
    .map(s => s.getStats().usageStats["StreamEvents"])
    .reduce((a, b) => ({ count: a.count + b.count, data: a.data + b.data }), {
      count: 0,
      data: 0
    });
  const shell = webSocketStats
    .map(s => s.getStats().usageStats["Shell"])
    .reduce((a, b) => ({ count: a.count + b.count, data: a.data + b.data }), {
      count: 0,
      data: 0
    });

  res.send({
    openClientWebSocketCount,
    totalRequestCount,
    totalTransferred: humanFileSize(totalTransferred),
    logStreaming: `${logStreaming.count} (${humanFileSize(logStreaming.data)})`,
    logDownload: `${logDownload.count} (${humanFileSize(logDownload.data)})`,
    eventStreaming: `${eventStreaming.count} (${humanFileSize(eventStreaming.data)})`,
    shell: `${shell.count} (${humanFileSize(shell.data)})`,
    version: packageJson.version
  });
});

app.post("/", async (req: Request, res: Response, next) => {
  const { certPem, keyPem, method, body, url } = req.body;

  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");

  try {
    const httpsAgent = new Agent({
      cert: certPem,
      key: keyPem,
      rejectUnauthorized: false
    });

    const response = await fetch(url, {
      method: method,
      body: body,
      headers: myHeaders,
      agent: httpsAgent
    });

    if (response.status === 200) {
      const responseText = await response.text();
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        res.contentType("application/json");
      } else {
        res.contentType("application/text");
      }
      res.send(responseText);
    } else {
      const _res = await response.text();
      console.log("Status code was not success (" + response.status + ") : " + _res);

      res.status(500);
      res.send(_res);
    }
  } catch (error) {
    next(error);
  }
});

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
  webSocketStats.push(stats);

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

  ws.on("close", (ws: WebSocket) => {
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
