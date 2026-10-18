import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { StoredSecretsOfDeployment } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { isSealedForOrganization, SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { TeamSecretsResealService } from "./team-secrets-reseal.service";

import { registerFakeSdlSecretsKms, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganization, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

registerFakeSdlSecretsKms();

describe(TeamSecretsResealService.name, () => {
  it("moves what members sealed for live teams onto each team's key, and leaves every other value as it was", async () => {
    const { reseal, seedDeployment, orphan, findToken, open } = await setup();
    const team = await seedOrganizationWithOwner();
    const deletedTeam = await seedOrganization({ deletedAt: new Date() });
    const moved = await seedDeployment({ filerId: team.user.id, organizationId: team.organization.id });
    const orphaned = await orphan(await seedDeployment({ filerId: team.user.id, organizationId: team.organization.id }));
    const inDeletedTeam = await seedDeployment({ filerId: (await seedUser()).id, organizationId: deletedTeam.id });
    const personal = await seedDeployment({ filerId: (await seedUser()).id, organizationId: null });

    const dryRun = (await reseal({ dryRun: true })).unwrap();

    expect(dryRun).toMatchObject({
      deploymentsScanned: 2,
      deploymentsResealed: 1,
      deploymentsWhoseMemberKeyIsGone: [`${team.organization.id}/${orphaned.dseq}`]
    });
    expect(await findToken(moved)).toBe(moved.sealedSecrets);

    const report = (await reseal({ dryRun: false })).unwrap();

    expect(report).toMatchObject({ deploymentsResealed: 1, secretsResealed: 1, teamsResealed: 1, deploymentsMovedByAnotherWriter: 0 });
    const resealed = await findToken(moved);
    expect(isSealedForOrganization(resealed)).toBe(true);
    await expect(open({ userId: null, organizationId: team.organization.id, dseq: moved.dseq, sealedSecrets: resealed })).resolves.toEqual(moved.secrets);
    expect(await findToken(orphaned)).toBe(orphaned.sealedSecrets);
    expect(await findToken(inDeletedTeam)).toBe(inDeletedTeam.sealedSecrets);
    expect(await findToken(personal)).toBe(personal.sealedSecrets);

    expect((await reseal({ dryRun: false })).unwrap()).toMatchObject({ deploymentsResealed: 0, deploymentsAlreadyUnderTeamKey: 1 });
  });

  async function setup() {
    await warmSealingKeyAsBootWould();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const deploymentSettings = resolveTable("DeploymentSettings");
    const executionContextService = container.resolve(ExecutionContextService);
    const sdlSecretsService = container.resolve(SdlSecretsService);

    async function seedDeployment({ filerId, organizationId }: { filerId: string; organizationId: string | null }) {
      const dseq = createDseq();
      const secrets = { API_TOKEN: faker.string.alphanumeric(24) };
      const sealedSecrets = (await executionContextService.runWithContext(
        async () => await sdlSecretsService.sealForStorage({ userId: filerId, dseq, secrets })
      ))!;
      const { id } = await seedDeploymentSetting({ userId: filerId, organizationId, dseq, sealedSecrets, autoTopUpEnabled: false });

      return { id, dseq, secrets, sealedSecrets };
    }

    async function orphan<T extends { id: string }>(deployment: T) {
      await db.update(deploymentSettings).set({ userId: null }).where(eq(deploymentSettings.id, deployment.id));

      return deployment;
    }

    async function findToken({ id }: { id: string }) {
      const [row] = await db.select({ sealedSecrets: deploymentSettings.sealedSecrets }).from(deploymentSettings).where(eq(deploymentSettings.id, id));

      return row.sealedSecrets!;
    }

    async function open(stored: StoredSecretsOfDeployment) {
      return await executionContextService.runWithContext(async () => await sdlSecretsService.openStored(stored));
    }

    async function reseal(options: { dryRun: boolean }) {
      return await container.resolve(TeamSecretsResealService).resealTeamDeployments(options);
    }

    return { reseal, seedDeployment, orphan, findToken, open };
  }
});
