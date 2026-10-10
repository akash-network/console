import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { DeploymentOrganizationActivityService } from "./deployment-organization-activity.service";

import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationWithOwner, seedProject } from "@test/seeders/db/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

describe(DeploymentOrganizationActivityService.name, () => {
  it("files a close made outside any request into the deployment's organization and project", async () => {
    const { service, user, organization, project, setting, activitiesOf } = await setup();

    await service.recordClosed({ userId: user.id, dseq: setting.dseq }, { actorUserId: null, reason: "runtime_limit_reached" });

    expect(await activitiesOf(organization.id)).toEqual([
      expect.objectContaining({
        projectId: project.id,
        type: "deployment_closed",
        actorUserId: null,
        payload: { dseq: setting.dseq, name: setting.name, reason: "runtime_limit_reached" }
      })
    ]);
  });

  it("files a creation into the deployment's organization even when the request runs in another one", async () => {
    const { service, user, organization, project, setting, activitiesOf } = await setup();
    const { organization: other } = await seedOrganizationWithOwner();
    const executionContextService = container.resolve(ExecutionContextService);

    await executionContextService.runWithContext(async () => {
      executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext({ organizationId: other.id }));
      await service.recordCreated({ userId: user.id, dseq: setting.dseq });
    });

    expect(await activitiesOf(other.id)).toEqual([]);
    expect(await activitiesOf(organization.id)).toEqual([
      expect.objectContaining({ projectId: project.id, type: "deployment_created", actorUserId: user.id, payload: { dseq: setting.dseq, name: setting.name } })
    ]);
  });

  async function setup() {
    const service = container.resolve(DeploymentOrganizationActivityService);
    const { user, organization } = await seedOrganizationWithOwner();
    const project = await seedProject({ organizationId: organization.id });
    const setting = await seedDeploymentSetting({ userId: user.id, organizationId: organization.id, projectId: project.id, name: "web" });
    const activities = resolveTable("OrganizationActivities");

    const activitiesOf = async (organizationId: string) =>
      await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(activities).where(eq(activities.organizationId, organizationId));

    return { service, user, organization, project, setting, activitiesOf };
  }
});
