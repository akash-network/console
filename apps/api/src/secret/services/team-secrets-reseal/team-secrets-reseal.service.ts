import { isHttpError } from "http-errors";
import { Err, Ok, type Result } from "ts-results";
import { inject, singleton } from "tsyringe";

import { assertBatchSize } from "@src/core/lib/batch-size/batch-size";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { DeploymentStoredSecretsOfTeam } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { isSealedForOrganization, SdlSecretsService, STORED_SECRETS_UNAVAILABLE_ERROR_CODE } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";

const DEFAULT_BATCH_SIZE = 100;

export interface TeamSecretsResealOptions {
  dryRun: boolean;
  batchSize?: number;
}

export interface TeamSecretsResealReport {
  dryRun: boolean;
  deploymentsScanned: number;
  deploymentsResealed: number;
  secretsResealed: number;
  teamsResealed: number;
  deploymentsAlreadyUnderTeamKey: number;
  deploymentsMovedByAnotherWriter: number;
  deploymentsWhoseMemberKeyIsGone: string[];
  elapsedMs: number;
}

type ResealPass = Omit<TeamSecretsResealReport, "dryRun" | "teamsResealed" | "elapsedMs"> & { teams: Set<string>; errors: unknown[] };

function isSealedForADepartedMember(error: unknown): boolean {
  return isHttpError(error) && error.errorCode === STORED_SECRETS_UNAVAILABLE_ERROR_CODE;
}

/** Moves the values members sealed for their teams onto each team's own key, so a member deleting their account no longer takes them along; a value whose member key is already gone cannot be moved and is only reported. */
@singleton()
export class TeamSecretsResealService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly sdlSecretsService: SdlSecretsService,
    private readonly executionContextService: ExecutionContextService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: TeamSecretsResealService.name });
  }

  async resealTeamDeployments({ dryRun, batchSize }: TeamSecretsResealOptions): Promise<Result<TeamSecretsResealReport, unknown[]>> {
    const startedAt = Date.now();
    const pageSize = assertBatchSize(batchSize ?? DEFAULT_BATCH_SIZE);
    const pass: ResealPass = {
      deploymentsScanned: 0,
      deploymentsResealed: 0,
      secretsResealed: 0,
      deploymentsAlreadyUnderTeamKey: 0,
      deploymentsMovedByAnotherWriter: 0,
      deploymentsWhoseMemberKeyIsGone: [],
      teams: new Set(),
      errors: []
    };

    this.logger.info({ event: "TEAM_SECRETS_RESEAL_START", dryRun });

    for await (const batch of this.deploymentSettingRepository.findStoredSecretsOfTeamsIteratively({ batchSize: pageSize })) {
      await this.executionContextService.runWithContext(async () => {
        for (const row of batch) {
          await this.#resealDeployment(row, pass, dryRun);
        }
      });

      this.logger.info({ event: "TEAM_SECRETS_RESEAL_BATCH", deploymentsScanned: pass.deploymentsScanned, deploymentsResealed: pass.deploymentsResealed });
    }

    const { teams, errors, ...counts } = pass;
    const report: TeamSecretsResealReport = { dryRun, ...counts, teamsResealed: teams.size, elapsedMs: Date.now() - startedAt };

    this.logger.info({ event: "TEAM_SECRETS_RESEAL_END", report });

    return errors.length > 0 ? Err(errors) : Ok(report);
  }

  async #resealDeployment(row: DeploymentStoredSecretsOfTeam, pass: ResealPass, dryRun: boolean): Promise<void> {
    pass.deploymentsScanned += 1;

    if (isSealedForOrganization(row.sealedSecrets)) {
      pass.deploymentsAlreadyUnderTeamKey += 1;

      return;
    }

    try {
      await this.#reseal(row, pass, dryRun);
    } catch (error) {
      if (isSealedForADepartedMember(error)) {
        pass.deploymentsWhoseMemberKeyIsGone.push(`${row.organizationId}/${row.dseq}`);
        this.logger.warn({ event: "TEAM_SECRETS_RESEAL_MEMBER_KEY_GONE", organizationId: row.organizationId, dseq: row.dseq });

        return;
      }

      pass.errors.push(error);
      this.logger.error({ event: "TEAM_SECRETS_RESEAL_DEPLOYMENT_FAILED", organizationId: row.organizationId, dseq: row.dseq, error });
    }
  }

  /** Opened through the path a deployment reads it by, so a value bound to a member other than the row's filer is refused rather than moved. */
  async #reseal(row: DeploymentStoredSecretsOfTeam, pass: ResealPass, dryRun: boolean): Promise<void> {
    const { organizationId, dseq } = row;
    const secrets = await this.sdlSecretsService.openStored({ userId: row.userId, organizationId, dseq, sealedSecrets: row.sealedSecrets });

    if (!dryRun) {
      const resealed = await this.sdlSecretsService.sealForTeam({ teamId: organizationId, dseq, secrets });

      if (!(await this.deploymentSettingRepository.resealIfUnchanged(row.id, row.sealedSecrets, resealed))) {
        pass.deploymentsMovedByAnotherWriter += 1;
        this.logger.warn({ event: "TEAM_SECRETS_RESEAL_MOVED_BY_ANOTHER_WRITER", organizationId, dseq });

        return;
      }
    }

    pass.deploymentsResealed += 1;
    pass.secretsResealed += Object.keys(secrets).length;
    pass.teams.add(organizationId);
  }
}
