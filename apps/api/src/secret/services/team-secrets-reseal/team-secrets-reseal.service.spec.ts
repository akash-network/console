import createError from "http-errors";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { DeploymentSettingRepository, DeploymentStoredSecretsOfTeam } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { STORED_SECRETS_UNAVAILABLE_ERROR_CODE } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { TeamSecretsResealService } from "./team-secrets-reseal.service";

const TWO_SECRETS = { DB_URL: "postgres://db", API_TOKEN: "token" };

function tokenWithClaims(claims: Record<string, string>) {
  const header = Buffer.from(JSON.stringify({ ...claims, alg: "dir", enc: "A256GCM", kid: randomUUID() })).toString("base64url");

  return `${header}..iv.ciphertext.tag`;
}

function memberSealed(input: { organizationId?: string; dseq?: string; userId?: string | null } = {}): DeploymentStoredSecretsOfTeam {
  const dseq = input.dseq ?? String(1000 + Math.floor(Math.random() * 9000));
  const userId = input.userId === undefined ? randomUUID() : input.userId;

  return {
    id: randomUUID(),
    dseq,
    userId,
    organizationId: input.organizationId ?? "team-1",
    sealedSecrets: tokenWithClaims({ sub: userId ?? randomUUID(), dseq }),
    updatedAt: new Date()
  };
}

function teamSealed(organizationId = "team-1"): DeploymentStoredSecretsOfTeam {
  const row = memberSealed({ organizationId });

  return { ...row, sealedSecrets: tokenWithClaims({ org: organizationId, dseq: row.dseq }) };
}

describe(TeamSecretsResealService.name, () => {
  it("moves a value a member sealed for the team onto the team's key", async () => {
    const row = memberSealed({ organizationId: "team-1", dseq: "100" });
    const { service, sdlSecretsService, deploymentSettingRepository } = setup({ rows: [row] });

    const report = (await service.resealTeamDeployments({ dryRun: false })).unwrap();

    expect(sdlSecretsService.openStored).toHaveBeenCalledWith({ userId: row.userId, organizationId: "team-1", dseq: "100", sealedSecrets: row.sealedSecrets });
    expect(sdlSecretsService.sealForTeam).toHaveBeenCalledWith({ teamId: "team-1", dseq: "100", secrets: TWO_SECRETS });
    expect(deploymentSettingRepository.resealIfUnchanged).toHaveBeenCalledWith(row.id, row.sealedSecrets, "team-1/100.sealed-for-team");
    expect(report).toMatchObject({ dryRun: false, deploymentsScanned: 1, deploymentsResealed: 1, secretsResealed: 2, teamsResealed: 1 });
  });

  it("leaves a value already sealed for its team as it is", async () => {
    const { service, sdlSecretsService } = setup({ rows: [teamSealed()] });

    const report = (await service.resealTeamDeployments({ dryRun: false })).unwrap();

    expect(sdlSecretsService.openStored).not.toHaveBeenCalled();
    expect(report).toMatchObject({ deploymentsScanned: 1, deploymentsAlreadyUnderTeamKey: 1, deploymentsResealed: 0, teamsResealed: 0 });
  });

  it("opens and counts on a dry run without sealing or writing anything", async () => {
    const { service, sdlSecretsService, deploymentSettingRepository } = setup({ rows: [memberSealed(), memberSealed()] });

    const report = (await service.resealTeamDeployments({ dryRun: true })).unwrap();

    expect(sdlSecretsService.openStored).toHaveBeenCalledTimes(2);
    expect(sdlSecretsService.sealForTeam).not.toHaveBeenCalled();
    expect(deploymentSettingRepository.resealIfUnchanged).not.toHaveBeenCalled();
    expect(report).toMatchObject({ dryRun: true, deploymentsResealed: 2, secretsResealed: 4, teamsResealed: 1 });
  });

  it("reports a value whose member key went with the member's account, without failing the run", async () => {
    const gone = memberSealed({ organizationId: "team-2", dseq: "200", userId: null });
    const { service, deploymentSettingRepository } = setup({ rows: [gone, memberSealed()], departedDseqs: ["200"] });

    const result = await service.resealTeamDeployments({ dryRun: false });

    expect(result.unwrap()).toMatchObject({ deploymentsWhoseMemberKeyIsGone: ["team-2/200"], deploymentsResealed: 1 });
    expect(deploymentSettingRepository.resealIfUnchanged).toHaveBeenCalledTimes(1);
  });

  it("re-seals the rest and fails the run at the end when a value will not open", async () => {
    const broken = memberSealed({ dseq: "300" });
    const readable = memberSealed({ dseq: "400" });
    const { service, deploymentSettingRepository } = setup({ rows: [broken, readable], unopenableDseqs: ["300"] });

    const result = await service.resealTeamDeployments({ dryRun: false });

    expect(result.err).toBe(true);
    expect(result.val).toEqual([expect.objectContaining({ message: "deployment 300 would not open" })]);
    expect(deploymentSettingRepository.resealIfUnchanged).toHaveBeenCalledWith(readable.id, readable.sealedSecrets, expect.any(String));
  });

  it("fails the run for a value the key service would not open, rather than reporting its key gone", async () => {
    const { service, sdlSecretsService } = setup({ rows: [memberSealed({ dseq: "500" })] });
    const unavailable = createError(503, "key service unavailable");
    sdlSecretsService.openStored.mockRejectedValue(unavailable);

    const result = await service.resealTeamDeployments({ dryRun: false });

    expect(result.err).toBe(true);
    expect(result.val).toEqual([unavailable]);
  });

  it("counts a value another writer replaced in between rather than overwriting it", async () => {
    const row = memberSealed();
    const { service } = setup({ rows: [row], movedIds: [row.id] });

    const report = (await service.resealTeamDeployments({ dryRun: false })).unwrap();

    expect(report).toMatchObject({ deploymentsMovedByAnotherWriter: 1, deploymentsResealed: 0, secretsResealed: 0, teamsResealed: 0 });
  });

  it("counts every team it moved values for once", async () => {
    const { service } = setup({
      rows: [memberSealed({ organizationId: "team-1" }), memberSealed({ organizationId: "team-1" }), memberSealed({ organizationId: "team-2" })]
    });

    const report = (await service.resealTeamDeployments({ dryRun: false })).unwrap();

    expect(report).toMatchObject({ deploymentsResealed: 3, teamsResealed: 2 });
  });

  it("opens every page inside a request context of its own, as holding a data key requires", async () => {
    const { service, sdlSecretsService, executionContextService } = setup({ pages: [[memberSealed()], [memberSealed()]] });
    const contexts: unknown[] = [];
    sdlSecretsService.openStored.mockImplementation(async () => {
      executionContextService.set("HELD_DATA_KEYS", executionContextService.get("HELD_DATA_KEYS") ?? new Map());
      contexts.push(executionContextService.get("HELD_DATA_KEYS"));

      return TWO_SECRETS;
    });

    await service.resealTeamDeployments({ dryRun: true });

    expect(contexts).toHaveLength(2);
    expect(contexts[0]).not.toBe(contexts[1]);
  });

  it("reads the team deployments a page at a time, a hundred unless told otherwise", async () => {
    const { service, deploymentSettingRepository } = setup({ rows: [] });

    await service.resealTeamDeployments({ dryRun: true });
    await service.resealTeamDeployments({ dryRun: true, batchSize: 25 });

    expect(deploymentSettingRepository.findStoredSecretsOfTeamsIteratively).toHaveBeenNthCalledWith(1, { batchSize: 100 });
    expect(deploymentSettingRepository.findStoredSecretsOfTeamsIteratively).toHaveBeenNthCalledWith(2, { batchSize: 25 });
  });

  function setup(input: {
    rows?: DeploymentStoredSecretsOfTeam[];
    pages?: DeploymentStoredSecretsOfTeam[][];
    departedDseqs?: string[];
    unopenableDseqs?: string[];
    movedIds?: string[];
  }) {
    const pages = input.pages ?? (input.rows?.length ? [input.rows] : []);
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findStoredSecretsOfTeamsIteratively.mockImplementation(async function* () {
      yield* pages;
    });
    deploymentSettingRepository.resealIfUnchanged.mockImplementation(async id => !input.movedIds?.includes(id));

    const sdlSecretsService = mock<SdlSecretsService>();
    sdlSecretsService.openStored.mockImplementation(async ({ dseq }) => {
      if (input.departedDseqs?.includes(dseq)) {
        throw createError(409, "sealed for a departed member", { errorCode: STORED_SECRETS_UNAVAILABLE_ERROR_CODE });
      }

      if (input.unopenableDseqs?.includes(dseq)) throw new Error(`deployment ${dseq} would not open`);

      return TWO_SECRETS;
    });
    sdlSecretsService.sealForTeam.mockImplementation(async ({ teamId, dseq }) => `${teamId}/${dseq}.sealed-for-team`);

    const createLogger = vi.fn<CreateLogger>(() => mock<ReturnType<CreateLogger>>());
    const executionContextService = new ExecutionContextService(createLogger);
    const service = new TeamSecretsResealService(deploymentSettingRepository, sdlSecretsService, executionContextService, createLogger);

    return { service, deploymentSettingRepository, sdlSecretsService, executionContextService };
  }
});
