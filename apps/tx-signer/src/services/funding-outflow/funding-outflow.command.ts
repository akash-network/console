import { parseArgs } from "node:util";

import { FUNDING_OUTFLOW_LIMIT_SCOPES, type FundingOutflowLimit, type FundingOutflowLimitScope } from "@src/model-schemas";
import type { FundingOutflowRepository, OutflowLimitKey } from "@src/repositories/funding-outflow/funding-outflow.repository";
import { OUTFLOW_WINDOW_HOURS } from "./funding-outflow.service";

const USAGE = [
  "Usage:",
  "  funding-outflow status",
  "  funding-outflow set-limit --denom <denom> --scope total|wallet [--wallet <address>] --max <amount> --mode report|enforce --by <who>",
  "  funding-outflow remove-limit --denom <denom> --scope total|wallet [--wallet <address>]"
].join("\n");
const MAX_WALLETS_LISTED = 10;
const WHOLE_AMOUNT = /^[1-9]\d*$/;
const LIMIT_MODES = ["report", "enforce"];

type CommandOptions = { denom?: string; scope?: string; wallet?: string; max?: string; mode?: string; by?: string };

export async function runFundingOutflowCommand(args: readonly string[], repository: FundingOutflowRepository): Promise<string> {
  const { positionals, values } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      denom: { type: "string" },
      scope: { type: "string" },
      wallet: { type: "string" },
      max: { type: "string" },
      mode: { type: "string" },
      by: { type: "string" }
    }
  });
  const [command, ...unexpected] = positionals;

  if (unexpected.length > 0) throw new Error(`Unexpected "${unexpected.join(" ")}". Put a value with spaces in quotes.\n${USAGE}`);
  if (command === "status") return await describeOutflow(repository);
  if (command === "set-limit") return await setLimit(repository, values);
  if (command === "remove-limit") return await removeLimit(repository, values);

  throw new Error(USAGE);
}

async function describeOutflow(repository: FundingOutflowRepository): Promise<string> {
  const [amountsByDenom, limits, wallets] = await Promise.all([
    repository.sumByDenomSince({ windowHours: OUTFLOW_WINDOW_HOURS }),
    repository.findLimits(),
    repository.sumByWalletSince({ windowHours: OUTFLOW_WINDOW_HOURS, limit: MAX_WALLETS_LISTED })
  ]);

  return [
    `Left the funding wallets in the last ${OUTFLOW_WINDOW_HOURS} hours:`,
    ...listOrNone([...amountsByDenom].map(([denom, amount]) => `${amount} ${denom}`)),
    "Limits:",
    ...listOrNone(limits.map(describeLimit).sort()),
    "Wallets that took the most:",
    ...listOrNone(wallets.map(({ walletAddress, denom, amount }) => `${walletAddress}: ${amount} ${denom}`))
  ].join("\n");
}

async function setLimit(repository: FundingOutflowRepository, options: CommandOptions): Promise<string> {
  const key = readLimitKey(options, "set-limit");
  const setBy = options.by?.trim();

  if (!options.max || !WHOLE_AMOUNT.test(options.max)) throw new Error(`set-limit needs --max as a whole amount above zero\n${USAGE}`);
  if (!options.mode || !LIMIT_MODES.includes(options.mode)) throw new Error(`set-limit needs --mode report or --mode enforce\n${USAGE}`);
  if (!setBy) throw new Error(`set-limit needs --by\n${USAGE}`);

  const limit = await repository.setLimit({ ...key, maxAmount: BigInt(options.max), isEnforced: options.mode === "enforce", setBy });

  return `Limit set. ${describeLimit(limit)}`;
}

async function removeLimit(repository: FundingOutflowRepository, options: CommandOptions): Promise<string> {
  const removed = await repository.removeLimit(readLimitKey(options, "remove-limit"));

  return removed.length > 0 ? `Limit removed. ${describeLimit(removed[0])}` : "Nothing changed. No such limit is set.";
}

function readLimitKey(options: CommandOptions, command: string): OutflowLimitKey {
  const denom = options.denom?.trim();
  const walletAddress = options.wallet?.trim();

  if (!denom) throw new Error(`${command} needs --denom\n${USAGE}`);
  if (!isLimitScope(options.scope)) throw new Error(`${command} needs --scope total or --scope wallet\n${USAGE}`);
  if (walletAddress && options.scope !== "wallet") throw new Error(`${command} takes --wallet with --scope wallet only\n${USAGE}`);

  return { denom, scope: options.scope, walletAddress: walletAddress || undefined };
}

function isLimitScope(scope: string | undefined): scope is FundingOutflowLimitScope {
  return FUNDING_OUTFLOW_LIMIT_SCOPES.some(known => known === scope);
}

function describeLimit(limit: FundingOutflowLimit): string {
  const subject = limit.scope === "total" ? "all wallets together" : limit.walletAddress ? `wallet ${limit.walletAddress}` : "each wallet";
  const mode = limit.isEnforced ? "enforced" : "reported only";

  return `${limit.denom}, ${subject}: ${limit.maxAmount} in ${OUTFLOW_WINDOW_HOURS} hours, ${mode}, set by ${limit.setBy}`;
}

function listOrNone(lines: readonly string[]): string[] {
  return lines.length > 0 ? lines.map(line => `  ${line}`) : ["  none"];
}
