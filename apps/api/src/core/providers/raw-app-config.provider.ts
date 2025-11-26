import { container, type InjectionToken, instancePerContainerCachingFactory } from "tsyringe";

export type RawAppConfig = Record<string, string | number | undefined>;
export const RAW_APP_CONFIG: InjectionToken<RawAppConfig> = Symbol("RAW_APP_CONFIG");

// temporary register it here because apps/api/src/db/dbConnection.ts does side effects that requires this to be present
container.register(RAW_APP_CONFIG, {
  useFactory: instancePerContainerCachingFactory(() => process.env)
});
