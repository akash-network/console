import type { AppServer } from "../../src/app";
import { startAppServer } from "../../src/app";

let server: AppServer | undefined;

export async function startServer(): Promise<string> {
  server = await startAppServer(0);
  return server.host;
}

export function stopServer(): void {
  server?.close();
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
