import { createOtelLogger } from "@akashnetwork/logging/otel";
import { createMongoAbility, type MongoAbility } from "@casl/ability";
import { context, trace } from "@opentelemetry/api";
import { Command, InvalidArgumentError } from "commander";
import { once } from "lodash";
import { Err } from "ts-results";
import { container } from "tsyringe";
import { z } from "zod";

import { Auth0AccountLinkerService } from "@src/auth/services/auth0-account-linker/auth0-account-linker.service";
import { MasterWalletMintController } from "@src/billing/controllers/master-wallet-mint/master-wallet-mint.controller";
import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { utcDayOf } from "@src/billing/lib/balance-snapshot-schedule/balance-snapshot-schedule";
import { BalanceRebuildService } from "@src/billing/services/balance-snapshot/balance-rebuild.service";
import { BalanceSnapshotService } from "@src/billing/services/balance-snapshot/balance-snapshot.service";
import { FundingWalletDrainService } from "@src/billing/services/funding-wallet-drain/funding-wallet-drain.service";
import { FundingWalletRotationService } from "@src/billing/services/funding-wallet-rotation/funding-wallet-rotation.service";
import { FundingWalletSweepService } from "@src/billing/services/funding-wallet-sweep/funding-wallet-sweep.service";
import { GpuWinBackCatchUpService } from "@src/billing/services/gpu-win-back-catch-up/gpu-win-back-catch-up.service";
import { ReturnedEscrowService } from "@src/billing/services/returned-escrow/returned-escrow.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TopUpDeploymentsController } from "@src/deployment/controllers/deployment/top-up-deployments.controller";
import { GpuBotController } from "@src/deployment/controllers/gpu-bot/gpu-bot.controller";
import { LeaseGpuController } from "@src/deployment/controllers/lease-gpu.controller";
import { GpuMarketPriceService } from "@src/gpu/services/gpu-market-price/gpu-market-price.service";
import { ProviderController } from "@src/provider/controllers/provider/provider.controller";
import { DataKeyRekeyController } from "@src/secret/controllers/data-key-rekey/data-key-rekey.controller";
import { DataKeyRewrapController } from "@src/secret/controllers/data-key-rewrap/data-key-rewrap.controller";
import { TeamSecretsResealController } from "@src/secret/controllers/team-secrets-reseal/team-secrets-reseal.controller";
import { AkashAddressSchema } from "@src/utils/schema";
import { WorkloadAbuseController } from "@src/workload-abuse/controllers/workload-abuse.controller";
import { APP_INITIALIZER, ON_APP_START } from "../core/providers/app-initializer";

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
  .option("-d, --dry-run", "Dry run the top up deployments", false)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      await container.resolve(TopUpDeploymentsController).topUpDeployments(options);
    });
  });

program
  .command("mint-act")
  .description("Burn master wallet AKT above the fee reserve into ACT, capped per run")
  .option("-d, --dry-run", "Log what would be burned without broadcasting", false)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(MasterWalletMintController).mint(options);
    });
  });

program
  .command("cleanup-stale-deployments")
  .description("Close deployments without leases created at least 10min ago")
  .option("-c, --concurrency <number>", "How many owners' closes run concurrently", value => z.number({ coerce: true }).optional().default(10).parse(value))
  .option("-d, --dry-run", "Log which deployments would be closed without broadcasting", false)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(TopUpDeploymentsController).cleanUpStaleDeployment(options);
    });
  });

program
  .command("notify-expiring-deployments")
  .description("Warn users whose runtime-limited deployments are about to reach their limit")
  .option("-d, --dry-run", "Log which users would be warned without sending any email", false)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(TopUpDeploymentsController).notifyExpiringDeployments(options);
    });
  });

program
  .command("notify-unreachable-deployments")
  .description("Warn users whose deployments run on a provider that has been unreachable for days")
  .option("-d, --dry-run", "Log which users would be warned without sending any email", false)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(TopUpDeploymentsController).notifyUnreachableProviderDeployments(options);
    });
  });

program
  .command("close-unreachable-deployments")
  .description("Close deployments whose every provider has been unreachable for weeks")
  .option("-d, --dry-run", "Log which deployments would be closed without broadcasting", false)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(TopUpDeploymentsController).closeUnreachableProviderDeployments(options);
    });
  });

program
  .command("probe-trial-deployments")
  .description("Schedule a workload probe for every live trial deployment that has none pending and queue stuck wipes again")
  .option("-d, --dry-run", "Log which deployments would be probed without enqueuing", false)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(WorkloadAbuseController).probeTrialDeployments(options);
    });
  });

program
  .command("detect-lease-gpus")
  .description("Schedule a bid offer record and a gpu read for every live managed gpu deployment that has none pending")
  .option("-d, --dry-run", "Log which deployments would be read without enqueuing", false)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(LeaseGpuController).detectLeaseGpus(options);
    });
  });

program
  .command("refresh-gpu-market-prices")
  .description("Recompute the market price range of every gpu model from the window's bids and leases")
  .option("-d, --dry-run", "Compute and log the ranges without replacing the stored ones", false)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(GpuMarketPriceService).refresh({ dryRun: options.dryRun });
    });
  });

program
  .command("first-purchase-bonus-win-back-catch-up")
  .description("Schedule the gpu win-back check of every person whose gpu deployment was created in the last 30 days")
  .option("-d, --dry-run", "Count the people who would be checked without scheduling their checks", false)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(GpuWinBackCatchUpService).run({ dryRun: options.dryRun, now: new Date() });
    });
  });

program
  .command("replay-behavioural-signals")
  .description("Re-score recorded workload probe evidence against the behavioural signals, writing nothing")
  .option("-s, --since <date>", "Start of the evidence window", value => z.coerce.date().parse(value))
  .option("-u, --until <date>", "End of the evidence window", value => z.coerce.date().parse(value))
  .option("-f, --fixture <path...>", "Replay a fixture file or a directory of fixture files")
  .option("-b, --bundled-fixtures", "Include the fixture corpus shipped with the repo", false)
  .option("--accel-min-vram-mb <number>", "Override the accelerator memory threshold", value => z.number({ coerce: true }).parse(value))
  .option("--artifact-min-mb <number>", "Override the artifact size threshold", value => z.number({ coerce: true }).parse(value))
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(WorkloadAbuseController).replayBehaviouralSignals({
        since: options.since,
        until: options.until,
        fixturePaths: options.fixture,
        bundledFixtures: options.bundledFixtures,
        accelMinVramMb: options.accelMinVramMb,
        artifactMinMb: options.artifactMinMb
      });
    });
  });

program
  .command("record-blocked-domain-mail-servers")
  .description("Look up and store the mail servers of every blocked email domain that has none recorded")
  .action(async (_options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(WorkloadAbuseController).recordBlockedDomainMailServers();
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

program
  .command("rewrap-data-keys")
  .description("Re-wrap every user's data key onto a KMS key version, so the versions it leaves behind can be disabled")
  .requiredOption(
    "-t, --target-version <string>",
    "KMS key version to move every data key onto, which must be the one this console is configured to wrap under",
    value => z.string().min(1).parse(value)
  )
  .option("-b, --batch-size <number>", "How many data keys are re-wrapped per transaction", value => z.number({ coerce: true }).int().positive().parse(value))
  .option("-d, --dry-run", "Report the census and what would be re-wrapped without writing anything", false)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(DataKeyRewrapController).rewrapDataKeys(options);
    });
  });

program
  .command("rekey-user-data-key")
  .description("Give one user a new data encryption key and re-seal their stored secrets under it, which is what contains a leaked data key")
  .requiredOption("-u, --user-id <uuid>", "The user to re-key", value => z.string().uuid().parse(value))
  .option("-b, --batch-size <number>", "How many of the user's deployments are read per page", value =>
    z.number({ coerce: true }).int().positive().parse(value)
  )
  .option("-d, --dry-run", "Open and count what would be re-sealed, without retiring the key or writing anything", false)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(DataKeyRekeyController).rekeyUser(options);
    });
  });

program
  .command("reseal-team-deployment-secrets")
  .description("Move the hidden variables members sealed for their teams onto each team's own data key, once team_data_keys is on for everyone")
  .option("-b, --batch-size <number>", "How many team deployments are read per page", value => z.number({ coerce: true }).int().positive().parse(value))
  .option("-d, --dry-run", "Open and count what would be re-sealed, without writing anything", false)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(TeamSecretsResealController).resealTeamDeployments(options);
    });
  });

program
  .command("add-standby-funding-wallet")
  .description("Record a funding wallet the signer already holds the key of, so it can be promoted later")
  .requiredOption("-a, --address <string>", "Address of the wallet to keep on standby", parseAkashAddress)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(FundingWalletRotationService).addStandby(options.address);
    });
  });

program
  .command("promote-funding-wallet")
  .description("Issue new grants from a standby funding wallet; the wallet it replaces keeps backing its users until each of them is moved")
  .requiredOption("-a, --address <string>", "Address of the standby wallet to promote", parseAkashAddress)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(FundingWalletRotationService).promote(options.address);
    });
  });

program
  .command("queue-funding-wallet-moves")
  .description("Queue a move to the active funding wallet for every user the draining one still backs, users with running deployments first")
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(FundingWalletDrainService).queueMoves();
    });
  });

program
  .command("funding-wallet-drain-status")
  .description("Log how many grants the draining funding wallet still backs and how the moves off it stand")
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(FundingWalletDrainService).describe();
    });
  });

program
  .command("retire-funding-wallet")
  .description("Retire the draining funding wallet once the chain shows no grant of it and no move off it is unfinished")
  .requiredOption("-a, --address <string>", "Address of the draining wallet to retire", parseAkashAddress)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(FundingWalletDrainService).retire(options.address);
    });
  });

program
  .command("credit-returned-escrow")
  .description("Queue a check, for every user moved off a funding wallet, that credits escrow their closed deployments returned to it since")
  .requiredOption("-a, --address <string>", "Address of the funding wallet the users were moved off", parseAkashAddress)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(ReturnedEscrowService).queueForEveryoneMovedOff(options.address);
    });
  });

program
  .command("sweep-funding-wallet")
  .description("Send the coins a retired funding wallet still holds to the active one, and report how many deployments it still funds")
  .requiredOption("-a, --address <string>", "Address of the retired wallet to sweep", parseAkashAddress)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(FundingWalletSweepService).sweep(options.address);
    });
  });

program
  .command("take-balance-snapshot")
  .description("Store every user's on-chain balance under today's UTC date, unless today's snapshot is already complete")
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(BalanceSnapshotService).take(utcDayOf(new Date()));
    });
  });

program
  .command("rebuild-balance")
  .description("Work a user wallet's balance out from a balance snapshot and the chain since, next to what the chain holds now; changes nothing")
  .requiredOption("-a, --address <string>", "Address of the user wallet", parseAkashAddress)
  .option("-d, --date <string>", "UTC day of the snapshot to start from (YYYY-MM-DD), the latest complete one when omitted", parseUtcDay)
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      return container.resolve(BalanceRebuildService).rebuild(options.address, options.date);
    });
  });

program
  .command("link-auth0-accounts")
  .description("Interactively link a secondary Auth0 account into a primary one (Auth0 only, no DB writes)")
  .action(async (options, command) => {
    await executeCliHandler(command.name(), async () => {
      await container.resolve(Auth0AccountLinkerService).linkAccountsInteractively();
    });
  });

const logger = createOtelLogger({ context: "CLI" });

function parseAkashAddress(value: string) {
  const address = AkashAddressSchema.safeParse(value);

  if (!address.success) throw new InvalidArgumentError("must be a valid akash address");

  return address.data;
}

function parseUtcDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) throw new InvalidArgumentError("must be a UTC day written as YYYY-MM-DD");

  return value;
}

async function executeCliHandler(name: string, handler: () => Promise<unknown>, options?: { type?: "action" | "daemon" }) {
  await context.with(trace.setSpan(context.active(), tracer.startSpan(name)), async () => {
    logger.info({ event: "COMMAND_START", name });

    try {
      const { migratePG } = await import("../core/providers/postgres.provider.ts");
      await Promise.all([migratePG(), ...container.resolveAll(APP_INITIALIZER).map(initializer => initializer[ON_APP_START]())]);

      const executionContextService = container.resolve(ExecutionContextService);
      const result = await executionContextService.runWithContext(async () => {
        executionContextService.set("CURRENT_USER", {
          id: "cli-user",
          bio: null,
          email: null,
          emailVerified: false,
          stripeCustomerId: null,
          subscribedToNewsletter: false,
          createdAt: new Date(),
          lastActiveAt: new Date(),
          lastIp: null,
          lastUserAgent: null,
          lastFingerprint: null,
          youtubeUsername: null,
          twitterUsername: null,
          githubUsername: null,
          onboardingSkippedAt: null,
          fairUsePolicyAcceptedAt: null,
          productUpdatesUnsubscribedAt: null,
          getStartedDismissedAt: null,
          agentSetupCopiedAt: null,
          githubStarPromptedAt: null,
          timezone: null,
          timezonePickedAt: null,
          lastUsedOrganizationId: null,
          accountStatus: "active",
          teamOrganizationLimit: null,
          projectsPerOrganizationLimit: null,
          userId: "system:cli-user",
          username: "___cli_user___",
          trial: false
        });
        executionContextService.set("ABILITY", createMongoAbility<MongoAbility>());
        return await handler();
      });

      if (result && result instanceof Err) {
        logger.error({ event: "COMMAND_ERROR", name, result: result.val });
        process.exitCode = 1;
      } else {
        logger.info({ event: "COMMAND_END", name });
      }
    } catch (error) {
      logger.error({ event: "COMMAND_ERROR", name, error });
      process.exitCode = 1;
    } finally {
      if (options?.type !== "daemon") {
        await shutdown();
      }
    }
  });
}

const SHUTDOWN_TIMEOUT_MS = 30_000;

const shutdown = once(async () => {
  const forceExit = setTimeout(() => {
    logger.warn({ event: "SHUTDOWN_TIMEOUT", message: "Forcing exit after timeout" });
    process.exit(process.exitCode ?? 1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  await container.dispose();
});
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
program.parse();
