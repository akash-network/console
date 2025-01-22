import http from "http";
import { AddressInfo } from "net";

import { app } from "../../src/app";

let server: http.Server | undefined;

export function startServer(): Promise<void> {
  return new Promise<void>(resolve => {
    server = app.listen(0, () => resolve());
  });
}

export function stopServer(): void {
  server?.close();
}

export async function request(url: string, init?: RequestInit): Promise<Response> {
  if (!server) {
    throw new Error("API has not been started. Ensure it is started before using client");
  }

  return fetch(`http://localhost:${(server.address() as AddressInfo).port}${url}`, {
    ...init,
    headers: {
      "Content-type": "application/json",
      ...init?.headers
    }
  });
}
