import "reflect-metadata";
import "@akashnetwork/env-loader";
import "./open-telemetry";

import { fork } from "child_process";

const SUPPORTED_INTERFACES = ["rest", "background-jobs"];

bootstrap(process.env);

async function bootstrap({ PORT = "3080", INTERFACE = "all" }: Record<string, string | undefined>): Promise<void> {
  const port = parseInt(PORT, 10) || 3080;

  if (INTERFACE === "all") {
    const boostrapList = SUPPORTED_INTERFACES.map((interfaceName, index) => bootstrapInChildProcess({ PORT: String(port + index), INTERFACE: interfaceName }));
    await Promise.all(boostrapList);
    return;
  }

  let appModule: { bootstrap: (port: number) => Promise<void> };
  switch (INTERFACE) {
    case "rest":
      appModule = await import("./rest-app.ts");
      break;
    case "background-jobs":
      appModule = await import("./background-jobs-app.ts");
      break;
    default:
      throw new Error(`Received invalid interface: ${INTERFACE}. Valid values: ${SUPPORTED_INTERFACES.join(", ")}`);
  }

  await appModule.bootstrap(port);
  console.log("process.send", process.send, INTERFACE);
  if (process.send) {
    process.on("disconnect", () => process.exit(0));
    process.send("ready");
  }
}

function bootstrapInChildProcess({ PORT, INTERFACE }: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = fork(__filename, {
      stdio: ["inherit", "inherit", "inherit", "ipc"],
      env: {
        ...process.env,
        PORT,
        INTERFACE
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
