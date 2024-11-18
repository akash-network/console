import "reflect-metadata";
import "@akashnetwork/env-loader";
import "./open-telemetry";
import "@src/utils/protobuf";

import { LoggerService } from "@akashnetwork/logging";
import { context, trace } from "@opentelemetry/api";
import { Command } from "commander";
import { container } from "tsyringe";
import { z } from "zod";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { chainDb } from "@src/db/dbConnection";
import { TopUpDeploymentsController } from "@src/deployment/controllers/deployment/deployment.controller";
import { UserController } from "@src/user/controllers/user/user.controller";
import { UserConfigService } from "@src/user/services/user-config/user-config.service";

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
  .option("-d, --dry-run", "Dry run the top up deployments", false)
  .description("Refill deployments with auto top up enabled")
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      await container.resolve(TopUpDeploymentsController).topUpDeployments({ dryRun: options.dryRun });
    });
  });

program
  .command("cleanup-stale-deployments")
  .description("Close deployments without leases created at least 10min ago")
  .option("-c, --concurrency <number>", "How much wallets is processed concurrently", value => z.number({ coerce: true }).optional().default(10).parse(value))
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      await container.resolve(TopUpDeploymentsController).cleanUpStaleDeployment(options);
    });
  });

const userConfig = container.resolve(UserConfigService);
program
  .command("cleanup-stale-anonymous-users")
  .description(`Remove users that have been inactive for ${userConfig.get("STALE_ANONYMOUS_USERS_LIVE_IN_DAYS")} days`)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      await container.resolve(UserController).cleanUpStaleAnonymousUsers();
    });
  });

const logger = LoggerService.forContext("CLI");

async function executeCliHandler(name: string, handler: () => Promise<void>) {
  await context.with(trace.setSpan(context.active(), tracer.startSpan(name)), async () => {
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
