import "reflect-metadata";
import "@src/providers";

import process from "node:process";
import { container } from "tsyringe";

import { FundingFreezeRepository } from "@src/repositories/funding-freeze/funding-freeze.repository";
import { runFundingFreezeCommand } from "@src/services/funding-freeze/funding-freeze.command";

runFundingFreezeCommand(process.argv.slice(2), container.resolve(FundingFreezeRepository))
  .then(line => {
    console.log(line);
  })
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => container.dispose());
