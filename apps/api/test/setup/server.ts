import type { AppServer } from "../../src/app";
import { initApp } from "../../src/app";

let server: AppServer | undefined;

export async function startServer(): Promise<string> {
  server = await initApp(0);

  return server!.host;
}

export async function stopServer(): Promise<void> {
  await server?.close();
}
