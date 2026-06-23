import type { InjectionToken } from "tsyringe";

export const APP_INITIALIZER: InjectionToken<AppInitializer> = Symbol("APP_INITIALIZER");
export const ON_APP_START = Symbol("ON_APP_START");
export const ON_APP_STOP = Symbol("ON_APP_STOP");

export interface AppInitializer {
  /**
   * Called when the app is starting up. This is called before the server starts listening for requests.
   * This is a good place to initialize any resources that need to be available before the server starts.
   * This method should not throw an error. If it does, the app will not start.
   */
  [ON_APP_START](): Promise<void> | void;

  /**
   * Called when the app is shutting down. This is called after the server stops listening for requests and after services are disposed.
   */
  [ON_APP_STOP]?(): Promise<void> | void;
}
