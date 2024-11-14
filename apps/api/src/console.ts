import "reflect-metadata";
import "@akashnetwork/env-loader";
import "./open-telemetry";
import "@src/utils/protobuf";

import { context, trace } from "@opentelemetry/api";
import { Command } from "commander";
import { container } from "tsyringe";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { LoggerService } from "@src/core";

const program = new Command();

program.name("API Console").description("CLI to run API commands").version("0.0.0");
const tracer = trace.getTracer("API Console");

program
  .command("refill-wallets")
  .description("Refill draining wallets")
  .action(async () => {
    await context.with(trace.setSpan(context.active(), tracer.startSpan("refill-wallets")), async () => {
      const logger = new LoggerService({ context: "CLI" });
      logger.info("Refilling wallets");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { migratePG, closeConnections } = await require("./core/providers/postgres.provider");
      await migratePG();

      await container.resolve(WalletController).refillWallets();

      await closeConnections();
      logger.info("Finished refilling wallets");
    });
  });

program.parse();
