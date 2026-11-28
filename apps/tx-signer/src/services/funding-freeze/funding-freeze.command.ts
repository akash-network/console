import { parseArgs } from "node:util";

import type { FundingFreeze } from "@src/model-schemas";
import type { FundingFreezeRepository } from "@src/repositories/funding-freeze/funding-freeze.repository";

const USAGE = ["Usage:", "  funding-freeze status", '  funding-freeze freeze --reason "<why>" --by <who>', "  funding-freeze lift --by <who>"].join("\n");

type CommandOptions = { reason?: string; by?: string };

export async function runFundingFreezeCommand(args: readonly string[], repository: FundingFreezeRepository): Promise<string> {
  const { positionals, values } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { reason: { type: "string" }, by: { type: "string" } }
  });
  const [command, ...unexpected] = positionals;

  if (unexpected.length > 0) throw new Error(`Unexpected "${unexpected.join(" ")}". Put a value with spaces in quotes.\n${USAGE}`);
  if (command === "status") return describeFreeze(await repository.findActive());
  if (command === "freeze") return await freezeFunding(repository, values);
  if (command === "lift") return await liftFreeze(repository, values);

  throw new Error(USAGE);
}

async function freezeFunding(repository: FundingFreezeRepository, options: CommandOptions): Promise<string> {
  const reason = options.reason?.trim();
  const frozenBy = options.by?.trim();

  if (!reason || !frozenBy) throw new Error(`freeze needs --reason and --by\n${USAGE}`);

  const activeFreeze = await repository.findActive();

  if (activeFreeze) return `Nothing changed. ${describeFreeze(activeFreeze)}`;

  return describeFreeze(await repository.create({ reason, frozenBy }));
}

async function liftFreeze(repository: FundingFreezeRepository, options: CommandOptions): Promise<string> {
  const liftedBy = options.by?.trim();

  if (!liftedBy) throw new Error(`lift needs --by\n${USAGE}`);

  const lifted = await repository.liftActive({ liftedBy });

  return lifted.length > 0 ? "Funding is no longer frozen. Each signer applies that on its next request." : "Nothing changed. Funding is not frozen.";
}

function describeFreeze(freeze: FundingFreeze | undefined): string {
  return freeze ? `Funding is frozen since ${freeze.frozenAt.toISOString()} by ${freeze.frozenBy}: ${freeze.reason}` : "Funding is not frozen.";
}
