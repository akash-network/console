import type { InjectionToken } from "tsyringe";

export const APP_INITIALIZER: InjectionToken<AppInitializer> = Symbol("APP_INITIALIZER");
export const ON_APP_START = Symbol("ON_APP_START");

export interface AppInitializer {
  [ON_APP_START](): Promise<void>;
}
