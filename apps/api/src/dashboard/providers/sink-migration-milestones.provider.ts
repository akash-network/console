import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import type { SinkMigrationMilestone } from "../config/sink-migration-milestones.config";
import { SINK_MIGRATION_MILESTONES_BY_NETWORK } from "../config/sink-migration-milestones.config";

export const SINK_MIGRATION_MILESTONES: InjectionToken<readonly SinkMigrationMilestone[]> = Symbol("SINK_MIGRATION_MILESTONES");

container.register(SINK_MIGRATION_MILESTONES, {
  useFactory: instancePerContainerCachingFactory(c => SINK_MIGRATION_MILESTONES_BY_NETWORK[c.resolve(CoreConfigService).get("NETWORK")])
});

export type { SinkMigrationMilestone };
