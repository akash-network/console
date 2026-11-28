import "reflect-metadata";
import "@src/providers";

import process from "node:process";
import { container } from "tsyringe";

import { FundingOutflowRepository } from "@src/repositories/funding-outflow/funding-outflow.repository";
import { runFundingOutflowCommand } from "@src/services/funding-outflow/funding-outflow.command";

runFundingOutflowCommand(process.argv.slice(2), container.resolve(FundingOutflowRepository))
  .then(lines => {
    console.log(lines);
  })
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => container.dispose());
