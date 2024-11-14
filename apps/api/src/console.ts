import "reflect-metadata";
import "@akashnetwork/env-loader";
import "./open-telemetry";

import { context, trace } from "@opentelemetry/api";
import { Command } from "commander";
import { container } from "tsyringe";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { LoggerService } from "@src/core";
import { chainDb } from "@src/db/dbConnection";
import { TopUpDeploymentsController } from "@src/deployment/controllers/deployment/deployment.controller";

const program = new Command();

program.name("API Console").description("CLI to run API commands").version("0.0.0");
const tracer = trace.getTracer("API Console");

program
  .command("refill-wallets")
  .description("Refill draining wallets")
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      await container.resolve(WalletController).refillWallets();
    });
  });

program
  .command("top-up-deployments")
  .description("Refill deployments with auto top up enabled")
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      await container.resolve(TopUpDeploymentsController).topUpDeployments();
    });
  });

async function executeCliHandler(name: string, handler: () => Promise<void>) {
  await context.with(trace.setSpan(context.active(), tracer.startSpan(name)), async () => {
    const logger = new LoggerService({ context: "CLI" });
    logger.info({ event: "COMMAND_START", name });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { migratePG, closeConnections } = await require("./core/providers/postgres.provider");
    await migratePG();
    await chainDb.authenticate();

    await handler();

    await closeConnections();
    await chainDb.close();
    logger.info({ event: "COMMAND_END", name });
  });
}

program.parse();
