import type { AppServer } from "../../src/app";
import { startAppServer } from "../../src/app";
import type { AppConfigInput } from "../../src/config/env.config";

let server: AppServer | undefined;

export async function startServer(untrustedConfig: AppConfigInput): Promise<string> {
  server = await startAppServer({ ...untrustedConfig, PORT: 0 });
  return server.host;
}

export async function stopServer(): Promise<void> {
  await server?.close("TEST_SHUTDOWN");
}

export async function request(url: string, init?: RequestInit): Promise<Response> {
  if (!server) {
    throw new Error("API has not been started. Ensure it is started before using client");
  }

  return fetch(server.host + url, {
    ...init,
    headers: {
      "Content-type": "application/json",
      ...init?.headers
    }
  });
}
