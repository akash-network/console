import cors from "cors";
import express from "express";

import { getAppStatus } from "./routes/getAppStatus";
import { proxyProviderRequest } from "./routes/proxyProviderRequest";

export const app = express();

const whitelist = [
  "http://localhost:3001",
  "http://localhost:3000",
  "https://cloudmos.grafana.net",
  "https://console.akash.network",
  "https://staging-console.akash.network",
  "https://akashconsole.vercel.app",
  "https://console-beta.akash.network"
];

app.disable("x-powered-by");
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
app.get("/status", getAppStatus);
app.post("/", proxyProviderRequest);
