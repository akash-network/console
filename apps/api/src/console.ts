import "reflect-metadata";

import { Command } from "commander";
import { container } from "tsyringe";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { PostgresMigratorService } from "@src/core";

const program = new Command();

program.name("API Console").description("CLI to run API commands").version("0.0.0");

program
  .command("refill-wallets")
  .description("Refill draining wallets")
  .action(async () => {
    await container.resolve(PostgresMigratorService).migrate();
    await container.resolve(WalletController).refillAll();
  });

program.parse();
