import { ChildProcess, spawn } from "child_process";
import * as path from "node:path";

import { localConfig } from "./services/local.config";
import { TestWalletService } from "./services/test-wallet.service";

let providerProxyProcess: ChildProcess;

export default async () => {
  // Initialize test wallet if needed
  if (!localConfig.MASTER_WALLET_MNEMONIC) {
    await new TestWalletService().init();
  }

  // Start provider-proxy
  providerProxyProcess = spawn("npm", ["run", "dev"], {
    cwd: path.resolve(__dirname, "../../provider-proxy"),
    stdio: "pipe",
    shell: true
  });

  // Wait for provider-proxy to be ready
  await new Promise((resolve, reject) => {
    let output = "";

    providerProxyProcess.stdout?.on("data", data => {
      output += data.toString();
      if (output.includes("Server is running")) {
        resolve(true);
      }
    });

    providerProxyProcess.stderr?.on("data", data => {
      console.error(`Provider Proxy Error: ${data}`);
    });

    providerProxyProcess.on("error", err => {
      reject(new Error(`Failed to start provider-proxy: ${err.message}`));
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      reject(new Error("Provider proxy failed to start within timeout"));
    }, 10000);
  });

  // Return a teardown function that will be called after all tests complete
  return async () => {
    if (providerProxyProcess) {
      providerProxyProcess.kill();
      await new Promise<void>(resolve => {
        providerProxyProcess.on("close", () => {
          resolve();
        });
      });
    }
  };
};
