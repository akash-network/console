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
import { GpuBotController } from "@src/deployment/controllers/gpu-bot/gpu-bot.controller";
import { UserController } from "@src/user/controllers/user/user.controller";
import { UserConfigService } from "@src/user/services/user-config/user-config.service";
import { ProviderController } from "./deployment/controllers/provider/provider.controller";

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
  .option("-c, --concurrency <number>", "How many wallets are processed concurrently", value => z.number({ coerce: true }).optional().default(10).parse(value))
  .option("-d, --dry-run", "Dry run the top up deployments", false)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      await container.resolve(TopUpDeploymentsController).topUpDeployments(options);
    });
  });

program
  .command("cleanup-stale-deployments")
  .description("Close deployments without leases created at least 10min ago")
  .option("-c, --concurrency <number>", "How many wallets is processed concurrently", value => z.number({ coerce: true }).optional().default(10).parse(value))
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      await container.resolve(TopUpDeploymentsController).cleanUpStaleDeployment(options);
    });
  });

program
  .command("cleanup-provider-deployments")
  .description("Close trial deployments for a provider")
  .option("-c, --concurrency <number>", "How many wallets are processed concurrently", value => z.number({ coerce: true }).optional().default(10).parse(value))
  .option("-d, --dry-run", "Dry run the trial provider cleanup", false)
  .option("-p, --provider <string>", "Provider address", value => z.string().parse(value))
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      await container.resolve(ProviderController).cleanupProviderDeployments(options);
    });
  });

program
  .command("gpu-pricing-bot")
  .description("Create deployments for every gpu models to get up to date pricing information")
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      await container.resolve(GpuBotController).createGpuBids();
    });
  });

const userConfig = container.resolve(UserConfigService);
program
  .command("cleanup-stale-anonymous-users")
  .description(`Remove users that have been inactive for ${userConfig.get("STALE_ANONYMOUS_USERS_LIVE_IN_DAYS")} days`)
  .option("-c, --concurrency <number>", "How many users are processed concurrently", value => z.number({ coerce: true }).optional().default(10).parse(value))
  .option("-d, --dry-run", "Dry run the clean up stale anonymous users", false)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      await container.resolve(UserController).cleanUpStaleAnonymousUsers(options);
    });
  });

const logger = LoggerService.forContext("CLI");

async function executeCliHandler(name: string, handler: () => Promise<void>) {
  await context.with(trace.setSpan(context.active(), tracer.startSpan(name)), async () => {
    logger.info({ event: "COMMAND_START", name });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { migratePG, closeConnections } = await require("./core/providers/postgres.provider");

    try {
      await migratePG();
      await chainDb.authenticate();

      await handler();

      logger.info({ event: "COMMAND_END", name });
    } catch (error) {
      logger.error({ event: "COMMAND_ERROR", name, message: error.message, stack: error.stack });
    } finally {
      await closeConnections();
      await chainDb.close();
    }
  });
}

program.parse();
