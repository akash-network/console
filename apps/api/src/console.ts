import "reflect-metadata";

import { Command } from "commander";
import dotenv from "dotenv";
import { container } from "tsyringe";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";

dotenv.config({ path: ".env.local" });
dotenv.config();

const program = new Command();

program.name("API Console").description("CLI to run API commands").version("0.0.0");

program
  .command("refill-wallets")
  .description("Refill draining wallets")
  .action(async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    await require("./core/providers/postgres.provider").migratePG();
    await container.resolve(WalletController).refillAll();
  });

program.parse();
