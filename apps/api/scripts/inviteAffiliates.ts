import "reflect-metadata";
import "@akashnetwork/env-loader";
import "@src/app";

import { createOtelLogger } from "@akashnetwork/logging/otel";
import { Command } from "commander";
import { container } from "tsyringe";

import { AffiliateInvitationCatchUpService } from "@src/affiliate/services/affiliate-invitation/affiliate-invitation-catch-up.service";
import { JobQueueService } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";

interface InviteOptions {
  dryRun: boolean;
  confirmDatabase?: string;
}

const logger = createOtelLogger({ context: "INVITE_AFFILIATES" });

const program = new Command();

program
  .name("invite-affiliates")
  .description(
    "Queues the referral program invitation for every person whose net card spend reaches AFFILIATE_SELF_JOIN_MIN_SPEND_AMOUNT and who was not invited yet; the API's job worker sends the emails"
  )
  .option("-d, --dry-run", "Count the people who would be invited without queuing anything", false)
  .option("--confirm-database <name>", "The database the connection string must name, required unless --dry-run")
  .action(async (options: InviteOptions) => {
    try {
      logger.info({
        event: "INVITE_AFFILIATES_TARGET",
        dryRun: options.dryRun,
        database: databaseOf(container.resolve(CoreConfigService).get("POSTGRES_DB_URI"))
      });
      if (!options.dryRun) await startQueueForSending(options.confirmDatabase);

      const result = await container.resolve(AffiliateInvitationCatchUpService).run({ dryRun: options.dryRun });
      logger.info({ event: "INVITE_AFFILIATES_DONE", ...result, dryRun: options.dryRun });
    } catch (error) {
      logger.error({ event: "INVITE_AFFILIATES_FAILED", error });
      process.exitCode = 1;
    } finally {
      await container.dispose();
    }
  });

/** Only starts pg-boss, never its workers, so the deployed API's worker is the one that sends. */
async function startQueueForSending(confirmedDatabase: string | undefined): Promise<void> {
  const target = databaseOf(container.resolve(CoreConfigService).get("POSTGRES_DB_URI"));
  if (!confirmedDatabase || target?.name !== confirmedDatabase) {
    throw new Error(
      `Refusing to queue invitations: --confirm-database says "${confirmedDatabase ?? ""}" and the connection string names "${target?.name ?? "nothing readable"}"`
    );
  }

  await container.resolve(JobQueueService).setup();
}

/** Host and database name only: the connection string also carries the password. */
function databaseOf(uri: string): { host: string; name: string } | undefined {
  try {
    const { hostname, port, pathname } = new URL(uri);

    return { host: port ? `${hostname}:${port}` : hostname, name: pathname.slice(1) };
  } catch {
    return undefined;
  }
}

program.parseAsync();
