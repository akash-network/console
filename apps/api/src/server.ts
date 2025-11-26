import "reflect-metadata";
import "@akashnetwork/env-loader";

import { fork } from "child_process";

import { type RawAppConfig } from "./core/providers/raw-app-config.provider";

const SUPPORTED_INTERFACES = ["rest", "background-jobs"];

bootstrap(process.env as RawAppConfig);

async function bootstrap(rawAppConfig: RawAppConfig): Promise<void> {
  const INTERFACE = rawAppConfig.INTERFACE || "all";
  const port = parseInt(rawAppConfig.PORT?.toString() || "3080", 10) || 3080;

  if (INTERFACE === "all") {
    const boostrapList = SUPPORTED_INTERFACES.map((interfaceName, index) => bootstrapInChildProcess({ PORT: String(port + index), INTERFACE: interfaceName }));
    await Promise.all(boostrapList);
    return;
  }

  let appModule: { bootstrap: () => Promise<void> };
  switch (INTERFACE) {
    case "rest":
      appModule = await import("./rest-app");
      break;
    case "background-jobs":
      appModule = await import("./background-jobs-app");
      break;
    default:
      throw new Error(`Received invalid interface: ${INTERFACE}. Valid values: ${SUPPORTED_INTERFACES.join(", ")}`);
  }

  await appModule.bootstrap();
  if (process.send) {
    process.on("disconnect", () => process.exit(0));
    process.send("ready");
  }
}

function bootstrapInChildProcess({ PORT, INTERFACE }: RawAppConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = fork(__filename, {
      stdio: ["inherit", "inherit", "inherit", "ipc"],
      env: {
        ...process.env,
        PORT: String(PORT),
        INTERFACE: String(INTERFACE)
      },
      execArgv: process.execArgv
    });

    child.once("message", m => (m === "ready" ? resolve() : undefined));
    child.once("error", reject);
    child.once("exit", code => (code !== 0 ? reject(new Error(`[${INTERFACE}] exited ${code}`)) : undefined));

    process.on("SIGTERM", () => child.kill("SIGTERM"));
    process.on("SIGINT", () => child.kill("SIGINT"));
    process.on("exit", () => child.kill());
  });
}
